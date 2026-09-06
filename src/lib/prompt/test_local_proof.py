import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest
from PIL import Image

spec = importlib.util.spec_from_file_location("local_proof", Path(__file__).with_name("local-proof.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ProofTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
