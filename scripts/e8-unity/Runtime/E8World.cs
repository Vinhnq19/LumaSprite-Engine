using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.Tilemaps;

public sealed class E8World
{
    public const int SolidLayer = 8;
    public readonly E8SceneData Data;
    public readonly Scene Scene;
    public readonly GameObject Root;
    public readonly Tilemap Tilemap;
    public readonly float TilemapBuildMs;
    public readonly SpriteRenderer Actor;
    public readonly Sprite OriginalActor;
    readonly E8SceneData.Landmark[] targets;
    int lastInteractionFrame = -1;
    public readonly Dictionary<string, SpriteRenderer> Objects = new Dictionary<string, SpriteRenderer>();
    public readonly List<UnityEngine.Object> Transient = new List<UnityEngine.Object>();
    readonly int actorOrder;

    public Vector2Int Position { get; private set; }
    public int Interactions { get; private set; }
    public E8SceneData.Landmark ActiveTarget { get; private set; }
    public bool Near => ActiveTarget != null;
    public event Action<string> Interacted;

    public E8World(E8SceneData data)
    {
        Data = data;
        Scene = SceneManager.CreateScene(data.id + "-" + data.light);
        Root = new GameObject(data.id);
        SceneManager.MoveGameObjectToScene(Root, Scene);
        var grid = Object("Atlas Grid").AddComponent<Grid>();
        grid.cellSize = new Vector3(data.tiles.size / (float)data.pixelsPerUnit, data.tiles.size / (float)data.pixelsPerUnit, 1);
        var mapObject = Object("Atlas Tilemap", grid.transform);
        Tilemap = mapObject.AddComponent<Tilemap>();
        var tilesRenderer = mapObject.AddComponent<TilemapRenderer>();
        tilesRenderer.sortingOrder = -3;
        var tileClock = System.Diagnostics.Stopwatch.StartNew();
        var atlas = E8Assets.Texture(data.atlas);
        E8Assets.Check(atlas.width == data.tiles.atlasColumns * data.tiles.size && atlas.height % data.tiles.size == 0, "atlas import dimensions");
        var tiles = new Tile[data.tiles.cellCount];
        for (int i = 0; i < tiles.Length; i++)
        {
            var size = data.tiles.size;
            int x = i % data.tiles.atlasColumns * size, y = atlas.height - (i / data.tiles.atlasColumns + 1) * size;
            var sprite = Own(E8Assets.Slice(atlas, new Rect(x, y, size, size), new Vector2(.5f, .5f), data.pixelsPerUnit));
            tiles[i] = Own(ScriptableObject.CreateInstance<Tile>());
            tiles[i].sprite = sprite;
            tiles[i].colliderType = Tile.ColliderType.None;
        }
        int columns = data.width / data.tiles.size, rows = data.height / data.tiles.size;
        for (int y = 0; y < rows; y++) for (int x = 0; x < columns; x++)
            Tilemap.SetTile(new Vector3Int(x, rows - 1 - y, 0), tiles[data.tiles.ids[y * columns + x]]);

        TilemapBuildMs = (float)tileClock.Elapsed.TotalMilliseconds;
        Layer("Underlay correction", E8Assets.Texture(data.correction), Vector2Int.zero, Vector2Int.zero, -2);
        foreach (var layer in data.layers)
        {
            var renderer = Layer(layer.id, E8Assets.Texture(layer.texture), layer.at.Point, layer.pivot.Point, Order(layer.at.y, layer.order));
            Objects.Add(layer.id, renderer);
            if (layer.id == "surveyor")
            {
                Actor = renderer;
                OriginalActor = renderer.sprite;
                actorOrder = layer.order;
            }
        }
        E8Assets.Check(Actor != null, "missing playable Surveyor");
        foreach (var box in data.collision)
        {
            var item = Object("Solid ground mask");
            item.layer = SolidLayer;
            item.transform.position = new Vector3((box.x + box.w * .5f) / data.pixelsPerUnit,
                (data.height - box.y - box.h * .5f) / data.pixelsPerUnit, 0);
            var collider = item.AddComponent<BoxCollider2D>();
            collider.size = new Vector2(box.w / (float)data.pixelsPerUnit, box.h / (float)data.pixelsPerUnit);
        }
        Physics2D.SyncTransforms();
        targets = new[] { data.landmark };
        Place(data.spawn.Point);
    }

    public static int Order(int y, int tie) => y * 32 + tie;


    T Own<T>(T resource) where T : UnityEngine.Object
    {
        Transient.Add(resource);
        return resource;
    }

    GameObject Object(string name, Transform parent = null)
    {
        var obj = new GameObject(name);
        obj.transform.SetParent(parent == null ? Root.transform : parent, false);
        return obj;
    }

    SpriteRenderer Layer(string name, Texture2D texture, Vector2Int at, Vector2Int pivot, int depth)
    {
        var renderer = Object(name).AddComponent<SpriteRenderer>();
        renderer.sprite = Own(E8Assets.Slice(texture, new Rect(0, 0, texture.width, texture.height),
            new Vector2(pivot.x / (float)texture.width, 1 - pivot.y / (float)texture.height), Data.pixelsPerUnit));
        renderer.transform.position = Data.World(at);
        renderer.sortingOrder = depth;
        return renderer;
    }

    public bool PhysicsBlocked(Vector2Int point)
    {
        var size = new Vector2(2 * Data.clearance.x + 1, 2 * Data.clearance.y + 1) / Data.pixelsPerUnit;
        if (Physics2D.OverlapBox(Data.CellCenter(point.x, point.y), size, 0, 1 << SolidLayer) == null) return false;
        // Resolve the broad-phase padding at the same cell centers as the exported masks.
        for (int y = point.y - Data.clearance.y; y <= point.y + Data.clearance.y; y++)
            for (int x = point.x - Data.clearance.x; x <= point.x + Data.clearance.x; x++)
                if (Physics2D.OverlapPoint(Data.CellCenter(x, y), 1 << SolidLayer) != null) return true;
        return false;
    }

    public void Place(Vector2Int point)
    {
        E8Assets.Check(Data.Fits(point), "mask rejects actor placement at " + point);
        E8Assets.Check(!PhysicsBlocked(point), "Physics2D rejects actor placement at " + point);
        Position = point;
        ActiveTarget = E8InteractionTarget.Select(point, targets, ActiveTarget);
        Actor.transform.position = Data.World(point);
        Actor.sortingOrder = Order(point.y, actorOrder);
    }

    public bool Step(Vector2Int direction)
    {
        E8Assets.Check(Math.Abs(direction.x) + Math.Abs(direction.y) == 1, "movement must be one cardinal pixel");
        var next = Position + direction;
        if (!Data.Fits(next) || PhysicsBlocked(next)) return false;
        Place(next);
        return true;
    }

    public bool Interact()
    {
        if (ActiveTarget == null || lastInteractionFrame == Time.frameCount) return false;
        lastInteractionFrame = Time.frameCount;
        Interactions++;
        Interacted?.Invoke(ActiveTarget.kind);
        return true;
    }

    public void MoveProp(string id, Vector2Int position)
    {
        var renderer = Objects[id];
        int tie = renderer.sortingOrder % 32;
        renderer.transform.position = Data.World(position);
        renderer.sortingOrder = Order(position.y, tie);
    }

    public void Deactivate() => Root.SetActive(false);

    public void Release()
    {
        foreach (var resource in Transient) UnityEngine.Object.Destroy(resource);
    }
}
