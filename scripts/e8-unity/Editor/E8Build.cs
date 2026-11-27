using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;

public static class E8Build
{
    [Serializable] sealed class Imported
    {
        public string path, format, filter, compression;
        public int width, height, mipCount;
    }

    [Serializable] sealed class Audit
    {
        public string editor, target, renderPipeline, input, contractRevision;
        public string testFramework, pixelPerfect;
        public int maps, foregroundTextures, tileSize, ppu, texturesCount;
        public Imported[] textures;
    }

    public static void Run()
    {
        var args = Environment.GetCommandLineArgs();
        string executable = args[Array.IndexOf(args, "-e8-build") + 1];
        var output = Path.GetDirectoryName(executable);
        Directory.CreateDirectory(output);
        var textures = new List<Imported>();
        foreach (var guid in AssetDatabase.FindAssets("t:Texture2D", new[] { "Assets/Resources/E8Input" }))
        {
            string path = AssetDatabase.GUIDToAssetPath(guid);
            var importer = (TextureImporter)AssetImporter.GetAtPath(path);
            importer.textureType = TextureImporterType.Default;
            importer.alphaSource = TextureImporterAlphaSource.FromInput;
            importer.alphaIsTransparency = false;
            importer.npotScale = TextureImporterNPOTScale.None;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.mipmapEnabled = false;
            importer.filterMode = FilterMode.Point;
            importer.wrapMode = TextureWrapMode.Clamp;
            importer.isReadable = true;
            importer.sRGBTexture = true;
            importer.SaveAndReimport();
            var tex = AssetDatabase.LoadAssetAtPath<Texture2D>(path);
            E8Assets.Check(tex != null && tex.filterMode == FilterMode.Point && tex.mipmapCount == 1 &&
                importer.textureCompression == TextureImporterCompression.Uncompressed, "imported texture " + path);
            textures.Add(new Imported { path = path, filter = tex.filterMode.ToString(), compression = importer.textureCompression.ToString(),
                format = tex.format.ToString(), width = tex.width, height = tex.height, mipCount = tex.mipmapCount });
        }

        var bundle = E8Bundle.Load();
        int maps = 0, foreground = 0;
        for (int i = 0; i < bundle.cases.Length; i++) foreach (var night in new[] { false, true })
        {
            var data = bundle.LoadScene(i, night);
            var atlas = E8Assets.Texture(data.atlas);
            var image = E8Assets.Texture(data.foreground);
            E8Assets.Check(image.width == data.width && image.height == data.height && atlas.width == data.tiles.atlasColumns * data.tiles.size,
                "imported atlas and foreground bounds");
            maps++;
            foreground++;
        }
        var input = new SerializedObject(AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/ProjectSettings.asset")[0]);
        var active = input.FindProperty("activeInputHandler");
        if (active != null) { active.intValue = 0; input.ApplyModifiedPropertiesWithoutUndo(); }

        PlayerSettings.companyName = "LumaSprite";
        PlayerSettings.productName = "LumaSprite E8 Acceptance";
        PlayerSettings.colorSpace = ColorSpace.Gamma;
        PlayerSettings.defaultScreenWidth = 960;
        PlayerSettings.defaultScreenHeight = 680;
        PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
        PlayerSettings.runInBackground = true;
        QualitySettings.antiAliasing = 0;
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        new GameObject("E8 Runtime Acceptance").AddComponent<E8Game>();
        const string host = "Assets/E8Hub.unity";
        E8Assets.Check(EditorSceneManager.SaveScene(scene, host), "save Unity entry scene");
        var build = BuildPipeline.BuildPlayer(new BuildPlayerOptions {
            scenes = new[] { host }, locationPathName = executable, target = BuildTarget.StandaloneWindows64, options = BuildOptions.None,
        });
        E8Assets.Check(build.summary.result == BuildResult.Succeeded, "Player build " + build.summary.result);
        var resolved = UnityEditor.PackageManager.PackageInfo.GetAllRegisteredPackages();
        var test = Array.Find(resolved, p => p.name == "com.unity.test-framework");
        var pixel = Array.Find(resolved, p => p.name == "com.unity.2d.pixel-perfect");
        File.WriteAllText(Path.Combine(output, "unity-import.json"), JsonUtility.ToJson(new Audit {
            editor = Application.unityVersion, target = build.summary.platform.ToString(),
            renderPipeline = "Built-in", input = "built-in keyboard input", testFramework = test?.version ?? "not resolved",
            pixelPerfect = pixel?.version ?? "orthographic camera and native point RenderTexture", maps = maps,
            foregroundTextures = foreground, tileSize = 16, ppu = 32, texturesCount = textures.Count,
            contractRevision = bundle.revision, textures = textures.ToArray(),
        }, true));
        Debug.Log("E8_BUILD_PASS");
    }
}
