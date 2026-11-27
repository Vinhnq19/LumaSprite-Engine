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
        foreach (var sprite in walk.Sprites) Object.DestroyImmediate(sprite);
    }
}
