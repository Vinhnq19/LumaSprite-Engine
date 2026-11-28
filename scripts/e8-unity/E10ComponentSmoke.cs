using System;
using System.IO;
using System.Security.Cryptography;
using UnityEditor;
using UnityEngine;

public static class E10ComponentSmoke
{
    [Serializable] public sealed class Canvas { public int w, h; }
    [Serializable] public sealed class Component { public Canvas canvas; public int[] pivot; public int pixelsPerUnit; }

    public static void Run()
    {
        var args = Environment.GetCommandLineArgs();
        int option = Array.IndexOf(args, "-e10-proof");
        E8Assets.Check(option >= 0 && option + 1 < args.Length, "component proof path");
        string proof = args[option + 1];
        byte[] expected = File.ReadAllBytes(Path.Combine(proof, "studio-r2.rgba"));
        var component = JsonUtility.FromJson<Component>(
            File.ReadAllText(Path.Combine(proof, "samples", "r2", "component.json")));
        int w = component.canvas.w, h = component.canvas.h;
        const string folder = "Assets/E10ReleaseProbe";
        const string asset = folder + "/studio-r2.png";
        E8Assets.Check(!Directory.Exists(folder) && !File.Exists(folder + ".meta"), "probe directory is already in use");
        AssetDatabase.CreateFolder("Assets", "E10ReleaseProbe");
        try
        {
            File.Copy(Path.Combine(proof, "studio-r2.png"), asset);
            AssetDatabase.ImportAsset(asset, ImportAssetOptions.ForceSynchronousImport);
            var importer = (TextureImporter)AssetImporter.GetAtPath(asset);
            importer.textureType = TextureImporterType.Default;
            importer.alphaSource = TextureImporterAlphaSource.FromInput;
            importer.alphaIsTransparency = false;
            importer.npotScale = TextureImporterNPOTScale.None;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.mipmapEnabled = false;
            importer.filterMode = FilterMode.Point;
            importer.isReadable = true;
            importer.SaveAndReimport();
            var texture = AssetDatabase.LoadAssetAtPath<Texture2D>(asset);
            E8Assets.Check(texture.width == w && texture.height == h && texture.filterMode == FilterMode.Point &&
                texture.mipmapCount == 1 && expected.Length == w * h * 4, "component texture settings");
            var pixels = texture.GetPixels32();
            for (int y = 0; y < h; y++) for (int x = 0; x < w; x++)
            {
                var pixel = pixels[(h - 1 - y) * w + x];
                int i = (y * w + x) * 4;
                E8Assets.Check(pixel.r == expected[i] && pixel.g == expected[i + 1] &&
                    pixel.b == expected[i + 2] && pixel.a == expected[i + 3], "component RGBA parity");
            }
            var pivot = new Vector2(component.pivot[0] / (float)w, 1f - component.pivot[1] / (float)h);
            var sprite = E8Assets.Slice(texture, new Rect(0, 0, w, h), pivot, component.pixelsPerUnit);
            E8Assets.Check(sprite.pivot == new Vector2(component.pivot[0], h - component.pivot[1]) &&
                sprite.pixelsPerUnit == component.pixelsPerUnit, "component pivot and PPU");
            UnityEngine.Object.DestroyImmediate(sprite);
            using var sha = SHA256.Create();
            var digest = BitConverter.ToString(sha.ComputeHash(expected)).Replace("-", "").ToLowerInvariant();
            Debug.Log($"E10_COMPONENT_UNITY_PASS {w}x{h} rgba={digest} pivot={component.pivot[0]},{component.pivot[1]} ppu={component.pixelsPerUnit}");
        }
        finally
        {
            AssetDatabase.DeleteAsset(folder);
        }
    }
}
