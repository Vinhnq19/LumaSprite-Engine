using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using NUnit.Framework;
using UnityEngine;

public sealed class E8ImportTests
{
    [Test]
    public void ImportedAtlasAndForegroundRetainNativeMetrics()
    {
        var bundle = E8Bundle.Load();
        for (int i = 0; i < bundle.cases.Length; i++) foreach (bool night in new[] { false, true })
        {
            var data = bundle.LoadScene(i, night);
            var atlas = E8Assets.Texture(data.atlas);
            var layer = E8Assets.Texture(data.foreground);
            Assert.AreEqual(260, data.tiles.ids.Length);
            Assert.AreEqual(256, atlas.width);
            Assert.AreEqual(FilterMode.Point, atlas.filterMode);
            Assert.AreEqual(1, atlas.mipmapCount);
            Assert.AreEqual(320, layer.width);
            Assert.AreEqual(208, layer.height);
            Assert.AreEqual(new Vector3(0, 6.5f, 0), data.World(Vector2Int.zero));
        }
    }

    [Test]
    public void AnimationFrameBoundariesFollowLockedMetadata()
    {
        var walk = new E8Animation("walk", 32);
        Assert.AreEqual(0, walk.FrameAt(119.999));
        Assert.AreEqual(1, walk.FrameAt(120));
        Assert.AreEqual(0, walk.FrameAt(880));
        Assert.AreEqual(new Vector2(30, 5), walk.Sprites[0].pivot);
        foreach (var sprite in walk.Sprites) UnityEngine.Object.DestroyImmediate(sprite);
    }

    [Test]
    public void NearbyTargetsRemainStableAndUseOriginalFivePixelRange()
    {
        var a = new E8SceneData.Landmark { stand = new E8Pixel { x = 10, y = 10 } };
        var b = new E8SceneData.Landmark { stand = new E8Pixel { x = 13, y = 10 } };
        var targets = new[] { a, b };
        Assert.AreSame(a, E8InteractionTarget.Select(new Vector2Int(12, 10), targets, a));
        Assert.AreSame(b, E8InteractionTarget.Select(new Vector2Int(13, 10), targets, a));
        Assert.AreSame(a, E8InteractionTarget.Select(new Vector2Int(10, 15), targets, null));
        Assert.IsNull(E8InteractionTarget.Select(new Vector2Int(10, 16), targets, a));
        b.stand = a.stand;
        Assert.AreSame(a, E8InteractionTarget.Select(a.stand.Point, targets, null));
    }

    [Test]
    public void PromptIsInDedicatedRailAndMarkerStaysInsideAllSceneViewports()
    {
        var bundle = E8Bundle.Load();
        foreach (var viewport in new[] { new Vector2Int(320, 232), new Vector2Int(704, 472), new Vector2Int(960, 680) })
            for (int i = 0; i < bundle.cases.Length; i++)
            {
                var data = bundle.LoadScene(i, false);
                var screen = E8InteractionHud.Viewport(viewport.x, viewport.y, data.width, data.height, out int scale);
                var prompt = E8InteractionHud.Prompt(screen, scale);
                Assert.GreaterOrEqual(prompt.yMin, 0);
                Assert.Less(prompt.yMax, screen.yMin);
                Assert.LessOrEqual(prompt.xMax, viewport.x);
                Assert.AreEqual(data.pixelsPerUnit, 32);
                var mark = E8InteractionHud.MarkerPixel(data, data.landmark);
                Assert.GreaterOrEqual(mark.x, 5);
                Assert.Less(mark.x, data.width - 4);
                Assert.GreaterOrEqual(mark.y, 5);
                Assert.Less(mark.y, data.height - 4);
            }
    }

    [Test]
    public void StudioZipImporterImportsRealOwnerMistfenZipAtX117()
    {
        string ownerZip = Path.GetFullPath("../.cache/e85-studio-zips/e8-mistfen-ferry-landing-day-e84-export.zip");
        if (!File.Exists(ownerZip)) ownerZip = @"D:\LumaSprite-Engine\.cache\e85-studio-zips\e8-mistfen-ferry-landing-day-e84-export.zip";
        Assert.IsTrue(File.Exists(ownerZip), "Missing Owner E8.4 ZIP: " + ownerZip);
        string tempOut = Path.Combine(Path.GetTempPath(), "e85-edit-owner-" + Guid.NewGuid().ToString("N"));
        try
        {
            var imported = E8StudioZipImporter.ImportZipToDirectory(ownerZip, tempOut, null, true);
            Assert.AreEqual("mistfen-ferry-landing", imported.SceneKey);
            Assert.AreEqual("day", imported.Light);
            Assert.AreEqual(117, imported.SpawnX);
            Assert.AreEqual(174, imported.SpawnY);
            Assert.AreEqual(8, imported.StudioRevision);
            Assert.AreEqual("APPROVED", imported.ApprovalStatus);
            Assert.AreEqual("b7606778e555e2f048356c1dbb6c89be7bbc9315683e7c0e88d99c6c4d779754", imported.ZipSha256);
            var parsed = JsonUtility.FromJson<E8SceneData>(File.ReadAllText(Path.Combine(tempOut, "mistfen-ferry-landing/day/scene.json")));
            parsed.Validate(parsed.revision, parsed.id, false);
            Assert.AreEqual(117, parsed.spawn.x);
            Assert.AreEqual(183, parsed.route.Length);
        }
        finally { if (Directory.Exists(tempOut)) Directory.Delete(tempOut, true); }
    }

    [Test]
    public void StudioDynamicInteractionLabelOverridesHardcodedDefaultAndPreservesLegacy()
    {
        var data = new E8SceneData { id = "mistfen-ferry-landing" };
        Assert.AreEqual("Kiểm tra bến phà", E8InteractionHud.PromptFor(data, new E8SceneData.Landmark { kind = "boarding-sill" }));
        Assert.AreEqual("Kiểm tra cầu phà E8.5", E8InteractionHud.PromptFor(data, new E8SceneData.Landmark { kind = "boarding-sill", label = "Kiểm tra cầu phà E8.5" }));
    }

    [Test]
    public void StudioZipImporterRejectsTraversalAndTamperedOrUnapprovedPackages()
    {
        Assert.Throws<InvalidDataException>(() => E8StudioZipImporter.ValidateZipEntryPath("../evil.png"));
        Assert.Throws<InvalidDataException>(() => E8StudioZipImporter.ValidateZipEntryPath("/abs/path.json"));
        Assert.Throws<InvalidDataException>(() => E8StudioZipImporter.ValidateZipEntryPath("C:\\win.json"));

        string validZip = @"D:\LumaSprite-Engine\.cache\e85-studio-zips\e8-mistfen-ferry-landing-day-e84-export.zip";
        var entries = E8StudioZipImporter.ReadZip(File.ReadAllBytes(validZip));
        string tmpZip = Path.Combine(Path.GetTempPath(), "e85-neg-" + Guid.NewGuid().ToString("N") + ".zip");
        string tmpDir = Path.Combine(Path.GetTempPath(), "e85-neg-out-" + Guid.NewGuid().ToString("N"));
        try
        {
            // 1) Tamper scene.json so manifest hash check fails
            var tampered = new Dictionary<string, byte[]>(entries);
            tampered["mistfen-ferry-landing/day/scene.json"] = Encoding.UTF8.GetBytes("{}");
            WriteStoredZip(tmpZip, tampered);
            Assert.Throws<InvalidDataException>(() => E8StudioZipImporter.ImportZipToDirectory(tmpZip, tmpDir));

            // 2) Unapproved sidecar with updated matching manifest hash must still be rejected by requireApproved
            var unapproved = new Dictionary<string, byte[]>(entries);
            string sidecarText = Encoding.UTF8.GetString(unapproved["studio-scene-sidecar.json"]).Replace("\"APPROVED\"", "\"UNREVIEWED\"");
            unapproved["studio-scene-sidecar.json"] = Encoding.UTF8.GetBytes(sidecarText);
            string mfText = Encoding.UTF8.GetString(unapproved["export-manifest.json"]).Replace(
                E8StudioZipImporter.Sha256Hex(entries["studio-scene-sidecar.json"]),
                E8StudioZipImporter.Sha256Hex(unapproved["studio-scene-sidecar.json"]));
            unapproved["export-manifest.json"] = Encoding.UTF8.GetBytes(mfText);
            WriteStoredZip(tmpZip, unapproved);
            Assert.Throws<InvalidDataException>(() => E8StudioZipImporter.ImportZipToDirectory(tmpZip, tmpDir, null, true));
        }
        finally
        {
            if (File.Exists(tmpZip)) File.Delete(tmpZip);
            if (Directory.Exists(tmpDir)) Directory.Delete(tmpDir, true);
        }
    }

    static void WriteStoredZip(string path, Dictionary<string, byte[]> entries)
    {
        using var fs = File.Create(path);
        using var bw = new BinaryWriter(fs, Encoding.UTF8);
        var cd = new List<byte[]>();
        uint offset = 0;
        foreach (var kv in entries)
        {
            byte[] name = Encoding.UTF8.GetBytes(kv.Key);
            byte[] data = kv.Value;
            bw.Write((uint)0x04034b50); bw.Write((ushort)20); bw.Write((ushort)0); bw.Write((ushort)0);
            bw.Write((ushort)0); bw.Write((ushort)0); bw.Write((uint)0);
            bw.Write((uint)data.Length); bw.Write((uint)data.Length);
            bw.Write((ushort)name.Length); bw.Write((ushort)0);
            bw.Write(name); bw.Write(data);

            using var cms = new MemoryStream();
            using var cw = new BinaryWriter(cms);
            cw.Write((uint)0x02014b50); cw.Write((ushort)20); cw.Write((ushort)20); cw.Write((ushort)0); cw.Write((ushort)0);
            cw.Write((ushort)0); cw.Write((ushort)0); cw.Write((uint)0);
            cw.Write((uint)data.Length); cw.Write((uint)data.Length);
            cw.Write((ushort)name.Length); cw.Write((ushort)0); cw.Write((ushort)0);
            cw.Write((ushort)0); cw.Write((ushort)0); cw.Write((uint)0); cw.Write(offset);
            cw.Write(name);
            cd.Add(cms.ToArray());
            offset += (uint)(30 + name.Length + data.Length);
        }
        uint cdSize = 0;
        foreach (var rec in cd) { bw.Write(rec); cdSize += (uint)rec.Length; }
        bw.Write((uint)0x06054b50); bw.Write((ushort)0); bw.Write((ushort)0);
        bw.Write((ushort)cd.Count); bw.Write((ushort)cd.Count);
        bw.Write(cdSize); bw.Write(offset); bw.Write((ushort)0);
    }
}
