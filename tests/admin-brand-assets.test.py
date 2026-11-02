import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("cloudflare_builder", ROOT / "scripts/build_cloudflare_pages.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class AdminBrandAssets(unittest.TestCase):
    def test_admin_brand_assets_are_local_png_not_member_redirect(self):
        with tempfile.TemporaryDirectory() as directory:
            sandbox = Path(directory)
            source = sandbox / "synthetic-app"
            output = sandbox / "output"
            (source / "admin").mkdir(parents=True)
            (source / "shared").mkdir()
            brand = source / "tennis-note-member-app/assets/brand"
            brand.mkdir(parents=True)
            (source / "release.json").write_text('{}', encoding="utf-8")
            (source / "admin/index.html").write_text(' '.join(['../tennis-note-member-app/assets/brand/app-icon-192.png'] * 2 + ['../tennis-note-member-app/assets/brand/app-icon-180.png']), encoding="utf-8")
            (source / "admin/styles.css").write_text('url("../tennis-note-member-app/assets/brand/app-icon-192.png")', encoding="utf-8")
            for size in (180, 192):
                (brand / f"app-icon-{size}.png").write_bytes(b"\x89PNG\r\n\x1a\n" + str(size).encode())
            with patch.object(builder, "APP_ROOT", source), patch.object(builder, "copy_public_pages"):
                builder.build_admin(output)
                builder.write_platform_files(output, "admin")
            for size in (180, 192):
                path = output / "assets" / "brand" / f"app-icon-{size}.png"
                self.assertEqual(path.read_bytes()[:8], b"\x89PNG\r\n\x1a\n")
                self.assertEqual(path.read_bytes(), (brand / path.name).read_bytes())
            self.assertIn('./assets/brand/app-icon-192.png', (output / 'index.html').read_text(encoding='utf-8'))
            self.assertIn('./assets/brand/app-icon-180.png', (output / 'index.html').read_text(encoding='utf-8'))
            self.assertIn('url("./assets/brand/app-icon-192.png")', (output / 'styles.css').read_text(encoding='utf-8'))
            self.assertIn('/tennis-note-member-app/* https://tennisnote-app.pages.dev/ 302', (output / '_redirects').read_text(encoding='utf-8'))


if __name__ == '__main__':
    unittest.main()
