import os
import json
import re
import glob
from pathlib import Path
import hashlib

# 画像軽量化用
try:
    from PIL import Image
except ImportError:
    Image = None
    print("Warning: Pillow が見つからないため画像軽量化はスキップされます")

# ルートディレクトリ（この build.py がある階層）
ROOT_DIR = Path(__file__).resolve().parent

# Configuration
POSTS_DIR = ROOT_DIR / 'posts'
OUTPUT_FILE = ROOT_DIR / 'experiments.js'
TEMPLATE_FILE = '_template.md'
LAB_LOGS_FILE = ROOT_DIR / 'lab_logs.json'

# 軽量版画像の出力先（ルート直下の posts/web_images/）
WEB_IMAGE_SUBDIR = 'posts/web_images'
WEB_IMAGE_DIR = ROOT_DIR / WEB_IMAGE_SUBDIR
WEB_IMAGE_DIR.mkdir(exist_ok=True)


def normalize_rel_path(path_str: str) -> str:
    """Windows の \\ を / に統一し Web 用にする"""
    return path_str.replace('\\', '/')


def resolve_path(md_filepath: str | Path, original_path_in_md: str) -> str:
    """
    md ファイル内に書かれたパス（相対/絶対混在）をリポジトリルートからの相対パスに正規化する。

    優先順位:
      1. md ファイルからの相対パス
      2. ルートからの相対パス
    """
    md_path = Path(md_filepath)
    md_dir = md_path.parent

    raw = original_path_in_md.strip()
    raw = normalize_rel_path(raw)

    # 絶対URLや data: はそのまま
    if raw.startswith('http://') or raw.startswith('https://') or raw.startswith('data:'):
        return raw

    # 先頭の ./ を削除
    raw_no_dot = raw.lstrip('./')

    # 1) md ファイルからの相対
    cand1 = (md_dir / raw_no_dot).resolve()
    if cand1.exists():
        rel = cand1.relative_to(ROOT_DIR)
        return normalize_rel_path(str(rel))

    # 2) ルートからの相対として解釈 images/xxx など
    cand2 = (ROOT_DIR / raw_no_dot).resolve()
    if cand2.exists():
        rel = cand2.relative_to(ROOT_DIR)
        return normalize_rel_path(str(rel))

    # どこにも無かった場合は警告して元のまま返す
    print(f"[WARN] 画像が見つかりません: {ROOT_DIR / raw_no_dot}")
    return raw_no_dot


def create_web_image(rel_from_root: str, exp_id: str) -> str:
    """
    ルートからの相対パスを受け取り、軽量版 WebP を web_images/ に出力して返す。
    Pillow が無い場合や失敗時は元パスをそのまま返す。
    """
    if not rel_from_root:
        return ''

    rel_from_root = normalize_rel_path(rel_from_root).lstrip('/')

    # すでに web_images のものはそのまま返す（無限ループ防止）
    if rel_from_root.startswith(WEB_IMAGE_SUBDIR):
        return rel_from_root

    original_abs_path = (ROOT_DIR / rel_from_root).resolve()

    if original_abs_path.is_dir():
        print(f"[WARN] 画像パスがディレクトリです: {original_abs_path}")
        return rel_from_root

    if not original_abs_path.exists():
        print(f"[WARN] 画像が見つかりません: {original_abs_path}")
        return rel_from_root  # とりあえず元の相対パスのまま返す

    if Image is None:
        return rel_from_root

    # 出力ファイル名: 実験ID + パスのハッシュで一意に
    base = exp_id or os.path.splitext(os.path.basename(rel_from_root))[0]
    digest = hashlib.md5(rel_from_root.encode("utf-8")).hexdigest()[:8]
    out_name = f"{base}-{digest}.webp"
    out_abs_path = WEB_IMAGE_DIR / out_name

    try:
        img = Image.open(original_abs_path)
        img.save(out_abs_path, "WEBP", quality=80)
        web_rel_path = f"{WEB_IMAGE_SUBDIR}/{out_name}"  # ルートからの相対
        return normalize_rel_path(str(web_rel_path))
    except Exception as e:
        print(f"[WARN] 画像の軽量化に失敗しました: {original_abs_path} -> {e}")
        return rel_from_root


def rewrite_body_images(body: str, md_filepath: str | Path, exp_id: str) -> str:
    """
    Markdown 本文の画像リンクを検出し、ローカル画像パスを軽量版のパスに書き換える。
    対象: ![alt](path/to/img.png)
    """
    pattern = re.compile(r'(!\[[^\]]*\]\()([^\)]+)(\))')

    def repl(match):
        before, path, after = match.groups()
        orig_path = path.strip()

        # 絶対URLや data: はそのまま
        if orig_path.startswith('http://') or orig_path.startswith('https://') or orig_path.startswith('data:'):
            return match.group(0)

        # mdファイルから見たパス -> ルートからの相対に解決
        rel_from_root = resolve_path(md_filepath, orig_path)
        # 軽量版を作成
        web_rel = create_web_image(rel_from_root, exp_id)

        return f"{before}{web_rel}{after}"

    return pattern.sub(repl, body)


def parse_md_file(filepath: str | Path):
    filepath = Path(filepath)
    with filepath.open('r', encoding='utf-8') as f:
        content = f.read()

    # Split frontmatter
    match = re.match(r'^---\n(.*?)\n---\n(.*)', content, re.DOTALL)
    if not match:
        print(f"Skipping {filepath}: No frontmatter found")
        return None

    fm_text = match.group(1)
    body = match.group(2).strip()

    metadata = {}
    links = []

    # tags: [a, b] をパース
    tags_match = re.search(r'tags:\s*\[(.*?)\]', fm_text)
    if tags_match:
        metadata['tags'] = [t.strip() for t in tags_match.group(1).split(',') if t.strip()]

    # id, title, date, image, summary をパース
    for field in ['id', 'title', 'date', 'image', 'summary']:
        field_match = re.search(fr'{field}:\s*(.+)', fm_text)
        if field_match:
            metadata[field] = field_match.group(1).strip()

    # links:
    link_matches = re.finditer(r'-\s*label:\s*(.+?)\n\s*url:\s*(.+)', fm_text)
    for lm in link_matches:
        links.append({
            'label': lm.group(1).strip(),
            'url': lm.group(2).strip()
        })

    exp_id = metadata.get('id', '')

    # frontmatter の image を軽量版パスに
    original_image_rel = metadata.get('image', '')
    web_image_rel = ''
    if original_image_rel:
        rel_from_root = resolve_path(filepath, original_image_rel)
        web_image_rel = create_web_image(rel_from_root, exp_id)

    # 本文の画像リンクを書き換える
    body_rewritten = rewrite_body_images(body, filepath, exp_id)

    experiment = {
        'id': exp_id,
        'title': metadata.get('title', 'No Title'),
        'date': metadata.get('date', ''),
        'tags': metadata.get('tags', []),
        'image': web_image_rel,  # サムネ用の軽量版
        'summary': metadata.get('summary', ''),
        'detail': {
            'content': body_rewritten,  # 画像パスを書き換えた本文
            'links': links
        }
    }
    return experiment


def load_lab_logs() -> list:
    """lab_logs.json があれば読み込んで返す。無ければ空リスト。"""
    if not LAB_LOGS_FILE.exists():
        print(f"[INFO] {LAB_LOGS_FILE.name} が見つからないため、labLogs は空で出力します。")
        return []

    try:
        # UTF-8 BOM 対応（utf-8-sig で読み込む）
        with LAB_LOGS_FILE.open('r', encoding='utf-8-sig') as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
            print(f"[WARN] {LAB_LOGS_FILE.name} の内容が配列ではありません。空で出力します。")
            return []
    except Exception as e:
        print(f"[WARN] {LAB_LOGS_FILE.name} の読み込みに失敗しました: {e}")
        return []


def main():
    experiments = []

    # Get all .md files in posts dir
    files = glob.glob(str(POSTS_DIR / '*.md'))

    for filepath in files:
        filename = os.path.basename(filepath)
        if filename.startswith('_'):  # Skip template
            continue

        print(f"Processing {filename}...")
        exp = parse_md_file(filepath)
        if exp:
            experiments.append(exp)

    # Sort by date desc
    experiments.sort(key=lambda x: x['date'], reverse=True)

    # Lab Logs を外部ファイルから取得
    lab_logs = load_lab_logs()

    js_content = f"""/**
 * AI Experimental Lab - Experiments Data
 * [AUTO-GENERATED] This file is generated by build.py. Do not edit manually.
 */

const experiments = {json.dumps(experiments, indent=2, ensure_ascii=False)};

// Lab Logs (managed in lab_logs.json)
const labLogs = {json.dumps(lab_logs, indent=2, ensure_ascii=False)};
"""

    with OUTPUT_FILE.open('w', encoding='utf-8') as f:
        f.write(js_content)

    print(f"Successfully generated {OUTPUT_FILE} with {len(experiments)} experiments.")


if __name__ == "__main__":
    main()
