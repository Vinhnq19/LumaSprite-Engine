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
}
