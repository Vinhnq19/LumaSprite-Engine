using System.Collections.Generic;
using UnityEngine;

public static class E8InteractionTarget
{
    public const int Reach = 5;
    public static int Distance(Vector2Int a, Vector2Int b) => Mathf.Abs(a.x - b.x) + Mathf.Abs(a.y - b.y);

    public static E8SceneData.Landmark Select(Vector2Int position, IReadOnlyList<E8SceneData.Landmark> targets, E8SceneData.Landmark previous)
    {
        E8SceneData.Landmark selected = null;
        int best = Reach + 1;
        foreach (var target in targets)
        {
            int distance = Distance(position, target.stand.Point);
            if (distance >= best) continue;
            best = distance;
            selected = target;
        }
        if (previous != null && selected != null)
        {
            int distance = Distance(position, previous.stand.Point);
            if (distance <= Reach && distance <= best + 1)
                foreach (var target in targets) if (target == previous) return previous;
        }
        return selected;
    }
}

public sealed class E8InteractionHud
{
    public const int Rail = 24;
    static readonly Color Gold = new Color32(255, 217, 124, 255);
    static readonly Color Ink = new Color32(18, 27, 29, 255);
    static readonly Color Light = new Color32(248, 244, 223, 255);
    readonly Texture2D marker;
    GUIStyle text, key;

    public E8InteractionHud()
    {
        marker = new Texture2D(9, 9, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point };
        var pixels = new Color32[81];
        for (int y = 0; y < 9; y++) for (int x = 0; x < 9; x++)
        {
            int distance = Mathf.Abs(x - 4) + Mathf.Abs(y - 4);
            if (distance == 4 || distance == 2) pixels[y * 9 + x] = Ink;
            if (distance == 3) pixels[y * 9 + x] = Gold;
        }
        marker.SetPixels32(pixels);
        marker.Apply(false, true);
    }

    public static Rect Viewport(int screenWidth, int screenHeight, int width, int height, out int scale)
    {
        scale = Mathf.Max(1, Mathf.FloorToInt(Mathf.Min(screenWidth / (float)width, screenHeight / (float)(height + Rail))));
        return new Rect(Mathf.Floor((screenWidth - width * scale) / 2f),
            Mathf.Floor((screenHeight - (height + Rail) * scale) / 2f) + Rail * scale,
            width * scale, height * scale);
    }

    public static Rect Prompt(Rect world, int scale) =>
        new Rect(world.x + 4 * scale, world.y - 21 * scale, world.width - 8 * scale, 17 * scale);

    public static Vector2Int MarkerPixel(E8SceneData data, E8SceneData.Landmark target)
    {
        var foot = target.stand.Point;
        int y = foot.y <= data.height - 14 ? foot.y + 9 : foot.y - 9;
        return new Vector2Int(Mathf.Clamp(foot.x, 5, data.width - 5), Mathf.Clamp(y, 5, data.height - 5));
    }

    public static string PromptFor(string scene) => scene == "mistfen-ferry-landing" ? "Kiểm tra bến phà" :
        scene == "floodgate-maintenance-yard" ? "Vận hành tay quay" : "Kiểm tra cửa lấy nước";

    public static string FeedbackFor(string scene) => scene == "mistfen-ferry-landing" ? "Đã kiểm tra điểm cập bến" :
        scene == "floodgate-maintenance-yard" ? "Đã kích hoạt sự kiện tay quay (demo)" : "Đã kiểm tra điểm điều khiển (demo)";

    public static string PromptFor(E8SceneData data, E8SceneData.Landmark target) =>
        target != null && !string.IsNullOrEmpty(target.label) ? target.label : PromptFor(data.id);

    public static string FeedbackFor(E8SceneData data, E8SceneData.Landmark target) =>
        target != null && !string.IsNullOrEmpty(target.label) ? "Đã kích hoạt: " + target.label + " (demo)" : FeedbackFor(data.id);

    static void Fill(Rect rect, Color color)
    {
        GUI.color = color;
        GUI.DrawTexture(rect, Texture2D.whiteTexture);
        GUI.color = Color.white;
    }

    public void Draw(E8SceneData data, Rect world, int scale, E8SceneData.Landmark active, string feedback)
    {
        var p = MarkerPixel(data, active ?? data.landmark);
        GUI.DrawTexture(new Rect(world.x + (p.x - 4) * scale, world.y + (p.y - 4) * scale, 9 * scale, 9 * scale), marker);
        var rail = Prompt(world, scale);
        Fill(rail, Ink);
        Fill(new Rect(rail.x, rail.y, scale, rail.height), Gold);
        if (text == null)
        {
            text = new GUIStyle(GUI.skin.label) { alignment = TextAnchor.MiddleCenter, fontStyle = FontStyle.Bold };
            key = new GUIStyle(text);
            text.normal.textColor = Light;
            key.normal.textColor = Ink;
        }
        text.fontSize = 12 * scale;
        key.fontSize = 12 * scale;
        if (!string.IsNullOrEmpty(feedback)) { GUI.Label(rail, feedback, text); return; }
        if (active == null) { GUI.Label(rail, "Đi tới dấu vàng để tương tác", text); return; }
        string label = PromptFor(data, active);
        float labelWidth = Mathf.Ceil(text.CalcSize(new GUIContent(label)).x);
        float start = Mathf.Floor(rail.center.x - (labelWidth + 25 * scale) / 2f);
        var box = new Rect(start, rail.y + 2 * scale, 18 * scale, 13 * scale);
        Fill(box, Gold);
        GUI.Label(box, "E", key);
        GUI.Label(new Rect(start + 23 * scale, rail.y, labelWidth + 2 * scale, rail.height), label, text);
    }

    public void Release() => Object.Destroy(marker);
}
