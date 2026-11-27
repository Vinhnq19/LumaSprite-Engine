using System;
using System.IO;
using UnityEngine;

[Serializable] public struct E8Pixel
{
    public int x, y;
    public Vector2Int Point => new Vector2Int(x, y);
}

[Serializable] public sealed class E8Case
{
    public string id, name, day, night;
}

[Serializable] public sealed class E8Bundle
{
    public int version;
    public string revision, animationManifestSha256;
    public E8Case[] cases;

    public static E8Bundle Load()
    {
        var bundle = E8Assets.Json<E8Bundle>("bundle");
        E8Assets.Check(bundle.version == 1 && bundle.cases.Length == 3 && bundle.revision.Length == 40, "bundle version and revision");
        return bundle;
    }

    public E8SceneData LoadScene(int index, bool night)
    {
        var entry = cases[index];
        var scene = E8Assets.Json<E8SceneData>(night ? entry.night : entry.day);
        scene.Validate(revision, entry.id, night);
        return scene;
    }
}

[Serializable] public sealed class E8SceneData
{
    [Serializable] public sealed class Map
    {
        public int size, atlasColumns, cellCount;
        public int[] ids;
    }
    [Serializable] public sealed class Layer
    {
        public string id, kind, texture;
        public E8Pixel at, pivot;
        public int order;
    }
    [Serializable] public sealed class Row
    {
        public int[] spans;
    }
    [Serializable] public sealed class Box
    {
        public int x, y, w, h;
    }
    [Serializable] public sealed class Probe
    {
        public string kind, collider;
        public E8Pixel from, to;
    }
    [Serializable] public sealed class Landmark
    {
        public string kind;
        public E8Pixel at, stand;
    }
    [Serializable] public sealed class Opening
    {
        public int x, y, w, h, threshold, expected;
        public E8Pixel original, staging;
        public string[] water;
    }

    public int version, width, height, pixelsPerUnit;
    public string revision, id, light, atlas, correction, foreground;
    public Map tiles;
    public E8Pixel spawn, clearance;
    public Layer[] layers;
    public Row[] walkable;
    public Box[] collision;
    public Probe[] probes;
    public E8Pixel[] route;
    public Landmark landmark;
    public Opening aperture;

    public Vector3 World(Vector2Int point) => new Vector3(point.x / (float)pixelsPerUnit, (height - point.y) / (float)pixelsPerUnit, 0);
    public Vector2 CellCenter(float x, float y) => new Vector2((x + .5f) / pixelsPerUnit, (height - y - .5f) / pixelsPerUnit);

    public bool Fits(Vector2Int point)
    {
        if (point.x < clearance.x || point.x >= width - clearance.x ||
            point.y < clearance.y || point.y >= height - clearance.y) return false;
        int left = point.x - clearance.x, right = point.x + clearance.x;
        for (int y = point.y - clearance.y; y <= point.y + clearance.y; y++)
        {
            var spans = walkable[y].spans;
            bool clear = false;
            for (int i = 0; i < spans.Length; i += 2)
                if (left >= spans[i] && right < spans[i + 1]) { clear = true; break; }
            if (!clear) return false;
        }
        return true;
    }

    public void Validate(string expectedRevision, string expectedId, bool night)
    {
        E8Assets.Check(version == 1 && revision == expectedRevision && id == expectedId && light == (night ? "night" : "day"), "scene provenance");
        E8Assets.Check(width == 320 && height == 208 && pixelsPerUnit == 32 && tiles.size == 16 && tiles.atlasColumns == 16 &&
            tiles.cellCount > 0 && tiles.ids.Length == width / tiles.size * (height / tiles.size), "scene and tile dimensions");
        foreach (int tile in tiles.ids) E8Assets.Check(tile >= 0 && tile < tiles.cellCount, "atlas id");
        E8Assets.Check(walkable.Length == height && clearance.x == 9 && clearance.y == 2, "walkable shape");
        for (int y = 0; y < height; y++)
        {
            var spans = walkable[y].spans;
            E8Assets.Check(spans.Length % 2 == 0, "walkable span pairs");
            int end = -1;
            for (int i = 0; i < spans.Length; i += 2)
            {
                E8Assets.Check(spans[i] >= 0 && spans[i] > end && spans[i + 1] > spans[i] && spans[i + 1] <= width, "walkable run");
                end = spans[i + 1];
            }
        }
        foreach (var c in collision) E8Assets.Check(c.x >= 0 && c.y >= 0 && c.w > 0 && c.h > 0 &&
            c.x + c.w <= width && c.y + c.h <= height, "collider bounds");
        E8Assets.Check(Fits(spawn.Point) && Fits(landmark.stand.Point) && route.Length > 1 &&
            route[0].Point == spawn.Point && route[route.Length - 1].Point == landmark.stand.Point, "route endpoints");
        for (int i = 0; i < layers.Length; i++) E8Assets.Check(layers[i].order == i && layers[i].at.y >= 0 &&
            layers[i].at.y <= height && (i == 0 || layers[i - 1].at.y <= layers[i].at.y), "layer ordering");
    }
}

public static class E8Assets
{
    public static void Check(bool ok, string label)
    {
        if (!ok) throw new InvalidDataException("E8: " + label);
    }

    public static T Json<T>(string path)
    {
        var source = Resources.Load<TextAsset>("E8Input/" + path);
        Check(source != null, "missing JSON " + path);
        return JsonUtility.FromJson<T>(source.text);
    }

    public static Texture2D Texture(string path)
    {
        var texture = Resources.Load<Texture2D>("E8Input/" + path);
        Check(texture != null && texture.filterMode == FilterMode.Point && texture.mipmapCount == 1, "texture settings " + path);
        return texture;
    }

    public static Sprite Slice(Texture2D texture, Rect rect, Vector2 pivot, int ppu)
    {
        return Sprite.Create(texture, rect, pivot, ppu, 0, SpriteMeshType.FullRect);
    }
}

public sealed class E8Animation
{
    [Serializable] public sealed class RectData
    {
        public int x, y, w, h;
    }
    [Serializable] public sealed class Frame
    {
        public int durationMs;
        public RectData rect;
    }
    [Serializable] public sealed class Foot { public string state; public int[] canvas, world; public int groundY, clearance, solePixels; }
    [Serializable] public sealed class Feet { public Foot near, far; }
    [Serializable] public sealed class Motion { public int index, rootX, advancePx; public Feet feet; }
    [Serializable] public sealed class RootMotion { public int cyclePx; public Motion[] frames; }
    [Serializable] public sealed class Timing
    {
        public int version, totalDurationMs;
        public string sampling, loop;
        public int[] pivot;
        public Frame[] frames;
        public RootMotion rootMotion;
    }

    public readonly Timing Data;
    public readonly Sprite[] Sprites;

    public E8Animation(string clip, int ppu)
    {
        Data = E8Assets.Json<Timing>("actor/" + clip);
        var texture = E8Assets.Texture("actor/" + clip);
        E8Assets.Check(Data.version == 1 && Data.sampling == "nearest" && Data.loop == "repeat" &&
            Data.pivot.Length == 2 && Data.frames.Length > 1, "animation contract " + clip);
        int duration = 0;
        Sprites = new Sprite[Data.frames.Length];
        for (int i = 0; i < Data.frames.Length; i++)
        {
            var frame = Data.frames[i];
            var cell = frame.rect;
            E8Assets.Check(frame.durationMs > 0 && cell.x >= 0 && cell.y >= 0 && cell.x + cell.w <= texture.width &&
                cell.y + cell.h <= texture.height && Data.pivot[0] < cell.w && Data.pivot[1] < cell.h, "animation cell");
            duration += frame.durationMs;
            Sprites[i] = E8Assets.Slice(texture, new Rect(cell.x, texture.height - cell.y - cell.h, cell.w, cell.h),
                new Vector2(Data.pivot[0] / (float)cell.w, 1 - Data.pivot[1] / (float)cell.h), ppu);
        }
        E8Assets.Check(duration == Data.totalDurationMs, "animation timing sum");
    }

    public int FrameAt(double elapsedMs)
    {
        double left = elapsedMs % Data.totalDurationMs;
        for (int i = 0; i < Data.frames.Length; i++)
        {
            left -= Data.frames[i].durationMs;
            if (left < 0) return i;
        }
        return 0;
    }
}
