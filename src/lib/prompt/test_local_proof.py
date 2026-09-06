import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from PIL import Image

spec = importlib.util.spec_from_file_location("local_proof", Path(__file__).with_name("local-proof.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ProofTests(unittest.TestCase):
    def test_observed_text_failures_and_inside_panel(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, output = Path(tmp) / "art.png", Path(tmp) / "proof.png"
            Image.new("RGBA", (1254, 1254), "white").save(source)
            original = source.read_bytes()
            regions = [
                {"name": "Westminster maker", "kind": "text", "box": [307, 175, 934, 280]},
                {"name": "Orlik left lettering", "kind": "text", "box": [138, 459, 370, 482]},
                {"name": "Orlik right lettering", "kind": "text", "box": [892, 456, 1117, 480]},
                {"name": "Writing panel", "kind": "panel", "box": [399, 980, 855, 1077]},
            ]
            result = module.render(source, output, regions=regions)
            self.assertFalse(result["declared_regions_inside_safe"])
            self.assertEqual([r["inside_safe"] for r in result["regions"]], [False, False, False, True])
            for path in [output, Path(tmp) / result["region_review"],
                         *[Path(tmp) / r["crop"] for r in result["regions"]]]:
                self.assertGreater(path.stat().st_size, 0)
                with Image.open(path) as im:
                    im.load()
                    self.assertEqual(im.format, "PNG")
            self.assertEqual(source.read_bytes(), original)

    def test_region_measurement_validation(self):
        base = [{"name": "name", "kind": "text", "box": [30, 30, 60, 40]},
                {"name": "panel", "kind": "panel", "box": [30, 50, 60, 60]}]
        for bounds in ([0, 0, float("nan"), 3], [0, 0, 101, 3], [10, 0, 5, 3],
                       [0, 0, True, 3], [1, 1, 1, 3], [1, 2, 3]):
            with self.assertRaises(ValueError):
                module.check_regions([{**base[0], "box": bounds}, base[1]], (100, 100), (10, 10, 89, 89), "circle")
        for regions in ([], base[:1], [base[0], base[0]], [{**base[0], "extra": 1}, base[1]]):
            with self.assertRaises(ValueError):
                module.check_regions(regions, (100, 100), (10, 10, 89, 89), "circle")
        checked = module.check_regions(base, (100, 100), (10, 10, 89, 89), "rectangle")
        self.assertTrue(all(r["inside_safe"] for r in checked))

    def test_cli_returns_failure_with_inspectable_region_results(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, output, regions = [Path(tmp) / n for n in ("art.png", "proof.png", "regions.json")]
            Image.new("RGB", (1254, 1254), "white").save(source)
            regions.write_text(json.dumps([
                {"name": "maker", "kind": "text", "box": [307, 175, 934, 280]},
                {"name": "panel", "kind": "panel", "box": [399, 980, 855, 1077]},
            ]))
            result = subprocess.run([sys.executable, str(Path(__file__).with_name("local-proof.py")),
                                     str(source), str(output), "--regions", str(regions)],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 1, result.stderr)
            report = json.loads(result.stdout)
            self.assertFalse(report["declared_regions_inside_safe"])
            self.assertTrue(output.exists())

    def test_circle_geometry_pixels_and_source_preservation(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, output = Path(tmp) / "art.png", Path(tmp) / "proof.png"
            Image.new("RGBA", (1100, 1100), "white").save(source)
            original = hashlib.sha256(source.read_bytes()).hexdigest()
            result = module.render(source, output)
            self.assertEqual(result["trim"], (50, 50, 1049, 1049))
            self.assertEqual(result["safe"], (100, 100, 999, 999))
            with Image.open(output) as proof:
                self.assertEqual(proof.getpixel((550, 50)), (0, 200, 255, 255))
                self.assertEqual(proof.getpixel((550, 550)), (255, 255, 255, 255))
                self.assertEqual(proof.getpixel((0, 0)), (255, 255, 255, 255))
                self.assertNotEqual(proof.getpixel((550, 20)), (255, 255, 255, 255))
                self.assertEqual(proof.getpixel((999, 550)), (230, 0, 180, 255))
            self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), original)
            self.assertEqual(result["source_sha256"], original)
            self.assertEqual(result["proof_sha256"], hashlib.sha256(output.read_bytes()).hexdigest())

    def test_rectangle_geometry_and_alpha(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, output = Path(tmp) / "art.png", Path(tmp) / "proof.png"
            Image.new("RGBA", (1300, 900), (10, 20, 30, 255)).save(source)
            result = module.render(source, output, "rectangle", 3, 2)
            self.assertEqual(result["trim"], (50, 50, 1249, 849))
            self.assertEqual(result["safe"], (100, 100, 1199, 799))
            with Image.open(output) as proof:
                self.assertEqual(proof.getpixel((600, 50)), (0, 200, 255, 255))
                self.assertEqual(proof.getpixel((600, 400)), (10, 20, 30, 255))
                self.assertNotEqual(proof.getpixel((0, 0)), (10, 20, 30, 255))

    def test_rejects_bad_geometry_and_overwrites(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, output = Path(tmp) / "art.png", Path(tmp) / "proof.png"
            Image.new("RGB", (100, 100), "white").save(source)
            for kwargs in ({"safe": 2}, {"bleed": -1}, {"width": float("nan")},
                           {"width": 0}, {"shape": "oval"}, {"height": 3},
                           {"shape": "rectangle", "height": 3}):
                with self.assertRaises(ValueError):
                    module.render(source, output, **kwargs)
                self.assertFalse(output.exists())
            with self.assertRaises(ValueError):
                module.render(source, source)
            output.write_bytes(b"keep")
            with self.assertRaises(ValueError):
                module.render(source, output)
            self.assertEqual(output.read_bytes(), b"keep")

    def test_failed_encoding_leaves_no_published_or_temporary_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, output = Path(tmp) / "art.png", Path(tmp) / "proof.png"
            Image.new("RGB", (100, 100), "white").save(source)
            def broken_save(image, target, **kwargs):
                target.write(b"incomplete")
                raise OSError("Simulated interrupted encode")
            with patch.object(Image.Image, "save", broken_save):
                with self.assertRaises(OSError):
                    module.render(source, output)
            self.assertFalse(output.exists())
            self.assertEqual(list(Path(tmp).iterdir()), [source])


if __name__ == "__main__":
    unittest.main()
