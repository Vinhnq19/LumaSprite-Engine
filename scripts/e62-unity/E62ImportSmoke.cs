using System;
using System.IO;
using System.Security.Cryptography;
using UnityEditor;
using UnityEngine;

public static class E62ImportSmoke
{
    [Serializable] sealed class Case
    {
        public string file, rgbaSha256;
        public bool transparent;
        public int width, height;
    }
    [Serializable] sealed class Input
    {
        public Case[] cases;
    }
    [Serializable] sealed class Result
    {
        public string unity, target, mode;
        public Case[] cases;
    }

    public static void Run()
    {
        var args = Environment.GetCommandLineArgs();
        string output = args[Array.IndexOf(args, "-e62-proof") + 1];
        var input = JsonUtility.FromJson<Input>(File.ReadAllText("Assets/E62Input/cases.json"));
        foreach (var item in input.cases)
        {
            var texture = E54Build.Texture("Assets/E62Input/" + item.file, item.transparent);
            if (texture.width != item.width || texture.height != item.height)
                throw new InvalidDataException("Dimensions changed at " + item.file);
            var pixels = texture.GetPixels32();
            var rgba = new byte[pixels.Length * 4];
            for (int y = 0; y < item.height; y++)
            for (int x = 0; x < item.width; x++)
            {
                var ink = pixels[(item.height - 1 - y) * item.width + x];
                int offset = (y * item.width + x) * 4;
                rgba[offset] = ink.r;
                rgba[offset + 1] = ink.g;
                rgba[offset + 2] = ink.b;
                rgba[offset + 3] = ink.a;
            }
            using (var sha = SHA256.Create())
            {
                string hash = BitConverter.ToString(sha.ComputeHash(rgba)).Replace("-", "").ToLowerInvariant();
                if (hash != item.rgbaSha256) throw new InvalidDataException("RGBA changed at " + item.file);
            }
        }
        File.WriteAllText(output, JsonUtility.ToJson(new Result {
            unity = Application.unityVersion, target = EditorUserBuildSettings.activeBuildTarget.ToString(),
            mode = "UNITY_EDITOR_IMPORT", cases = input.cases,
        }, true));
        Debug.Log("E62_IMPORT_PASS");
    }
}
