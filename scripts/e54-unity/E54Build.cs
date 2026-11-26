using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;

public static class E54Build
{
    [Serializable] sealed class ImportRow
    {
        public string file, filter, compression, format;
        public int width, height, mipCount;
        public bool readable, transparent;
    }
    [Serializable] sealed class ImportReport
    {
        public string editor, target;
        public ImportRow[] textures;
    }

    static readonly List<ImportRow> report = new List<ImportRow>();

    static Texture2D Texture(string asset, bool transparent)
    {
        var importer = AssetImporter.GetAtPath(asset) as TextureImporter;
        if (importer == null) throw new InvalidDataException(asset);
        importer.textureType = TextureImporterType.Default;
        importer.alphaSource = TextureImporterAlphaSource.FromInput;
        importer.alphaIsTransparency = false;
        importer.npotScale = TextureImporterNPOTScale.None;
        importer.textureCompression = TextureImporterCompression.Uncompressed;
        importer.mipmapEnabled = false;
        importer.filterMode = FilterMode.Point;
        importer.wrapMode = TextureWrapMode.Clamp;
        importer.isReadable = true;
        importer.SaveAndReimport();
        var t = AssetDatabase.LoadAssetAtPath<Texture2D>(asset);
        if (t == null || t.filterMode != FilterMode.Point || t.mipmapCount != 1 ||
            importer.textureCompression != TextureImporterCompression.Uncompressed || !t.isReadable)
            throw new InvalidDataException("Texture import setting " + asset);
        bool foundTransparent = Array.Exists(t.GetPixels32(), p => p.a == 0);
        if (foundTransparent != transparent) throw new InvalidDataException("Texture alpha " + asset);
        report.Add(new ImportRow { file = asset, filter = t.filterMode.ToString(), compression = importer.textureCompression.ToString(),
            format = t.format.ToString(), width = t.width, height = t.height, mipCount = t.mipmapCount,
            readable = t.isReadable, transparent = foundTransparent });
        return t;
    }

    static E54Playback.Input Character(string id, int order)
    {
        var path = "Assets/E54Input/" + id + "/";
        var obj = new GameObject(id);
        var renderer = obj.AddComponent<SpriteRenderer>();
        renderer.sortingOrder = order;
        return new E54Playback.Input { id = id, renderer = renderer,
            idle = Texture(path + "idle.png", true), walk = Texture(path + "walk.png", true), bridge = Texture(path + "bridge.png", true),
            idleTiming = AssetDatabase.LoadAssetAtPath<TextAsset>(path + "idle.json"),
            walkTiming = AssetDatabase.LoadAssetAtPath<TextAsset>(path + "walk.json"),
            manifest = AssetDatabase.LoadAssetAtPath<TextAsset>(path + "manifest.json") };
    }

    public static void Run()
    {
        var args = Environment.GetCommandLineArgs();
        var executable = args[Array.IndexOf(args, "-e54-build") + 1];
        Directory.CreateDirectory(Path.GetDirectoryName(executable));
        PlayerSettings.productName = "LumaSprite E5.4 Smoke";
        PlayerSettings.companyName = "LumaSprite";
        PlayerSettings.colorSpace = ColorSpace.Gamma;
        PlayerSettings.defaultScreenWidth = E54Playback.Width;
        PlayerSettings.defaultScreenHeight = E54Playback.Height;
        PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
        PlayerSettings.runInBackground = true;
        QualitySettings.antiAliasing = 0;
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        var camera = new GameObject("Fixed Pixel Camera").AddComponent<Camera>();
        camera.orthographic = true;
        camera.orthographicSize = E54Playback.Height / (2f * E54Playback.Ppu);
        camera.transform.position = new Vector3(E54Playback.Width / (2f * E54Playback.Ppu), E54Playback.Height / (2f * E54Playback.Ppu), -10);
        camera.allowMSAA = false;
        camera.allowHDR = false;
        camera.clearFlags = CameraClearFlags.SolidColor;
        camera.backgroundColor = Color.black;
        var smoke = new GameObject("Production Animation Smoke").AddComponent<E54Playback>();
        smoke.fixedCamera = camera;
        smoke.background = new GameObject("Approved Terrain and Props").AddComponent<SpriteRenderer>();
        smoke.background.sortingOrder = -1;
        smoke.terrain = new[] { Texture("Assets/E54Input/outdoor.png", false), Texture("Assets/E54Input/dungeon.png", false),
            Texture("Assets/E54Input/neutral.png", false) };
        smoke.cast = new[] { Character("surveyor", 1), Character("courier", 2) };
        const string scenePath = "Assets/E54Smoke.unity";
        if (!EditorSceneManager.SaveScene(scene, scenePath)) throw new IOException("Cannot save E54Smoke.");
        var build = BuildPipeline.BuildPlayer(new BuildPlayerOptions { scenes = new[] { scenePath }, locationPathName = executable,
            target = BuildTarget.StandaloneWindows64, options = BuildOptions.None });
        if (build.summary.result != BuildResult.Succeeded) throw new IOException("Player build " + build.summary.result);
        File.WriteAllText(Path.Combine(Path.GetDirectoryName(executable), "unity-import.json"),
            JsonUtility.ToJson(new ImportReport { editor = Application.unityVersion, target = build.summary.platform.ToString(),
                textures = report.ToArray() }, true));
        Debug.Log("E54_BUILD_PASS");
    }
}
