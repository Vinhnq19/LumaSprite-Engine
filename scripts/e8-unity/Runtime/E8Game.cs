using System;
using System.Collections;
using System.IO;
using UnityEngine;
using UnityEngine.SceneManagement;

public sealed class E8Game : MonoBehaviour
{
    [Serializable] sealed class SaveState
    {
        public string revision;
        public int index;
        public bool night;
        public int x, y;
    }

    public E8Bundle Bundle { get; private set; }
    public E8World World { get; private set; }
    public Camera Camera { get; private set; }
    public RenderTexture Frame { get; private set; }
    public E8Animation Idle { get; private set; }
    public E8Animation Walk { get; private set; }
    public int Index { get; private set; }
    public bool Night { get; private set; }
    public bool ProofMode { get; private set; }
    bool loading, walking;
    double animationMs;
    float movementBudget;
    E8InteractionHud interactionHud;
    string notice = "";
    public bool ProofOverlay { get; set; }
    public bool IsLoading => loading;
    public string Feedback => Time.unscaledTimeAsDouble < noticeUntil ? notice : "";
    public double StartupToAwakeMs { get; private set; }
    public double AwakeToSceneMs { get; private set; }
    public double ProcessUptimeMs => StartupToAwakeMs + (Time.realtimeSinceStartupAsDouble - awakeAt) * 1000;
    double awakeAt;
    double noticeUntil;
    public float LastRenderMs { get; private set; }
    const float MoveSpeed = 42;

    void Awake()
    {
        awakeAt = Time.realtimeSinceStartupAsDouble;
        using (var process = System.Diagnostics.Process.GetCurrentProcess())
            StartupToAwakeMs = (DateTime.UtcNow - process.StartTime.ToUniversalTime()).TotalMilliseconds;
        interactionHud = new E8InteractionHud();
        Bundle = E8Bundle.Load();
        Idle = new E8Animation("idle", 32);
        Walk = new E8Animation("walk", 32);
        var cameraObject = new GameObject("Native pixel camera");
        cameraObject.transform.SetParent(transform);
        Camera = cameraObject.AddComponent<Camera>();
        Camera.enabled = false;
        Camera.orthographic = true;
        Camera.allowHDR = false;
        Camera.allowMSAA = false;
        Camera.clearFlags = CameraClearFlags.SolidColor;
        Camera.backgroundColor = Color.black;
        Frame = new RenderTexture(320, 208, 0, RenderTextureFormat.ARGB32, RenderTextureReadWrite.Linear)
        {
            filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp, useMipMap = false, antiAliasing = 1,
        };
        Frame.Create();
        Camera.targetTexture = Frame;
        Application.targetFrameRate = 60;
        QualitySettings.vSyncCount = 0;
        var args = Environment.GetCommandLineArgs();
        int proof = Array.IndexOf(args, "-e8-proof");
        ProofMode = proof >= 0;
        if (ProofMode) StartCoroutine(new E8Smoke(this, args[proof + 1]).Run());
        else StartCoroutine(Load(0, false));
    }

    public IEnumerator Load(int index, bool night, Vector2Int? position = null)
    {
        E8Assets.Check(index >= 0 && index < Bundle.cases.Length, "scene index");
        loading = true;
        notice = "";
        noticeUntil = 0;
        if (World != null)
        {
            var previous = World;
            previous.Deactivate();
            yield return SceneManager.UnloadSceneAsync(previous.Scene);
            E8Assets.Check(!previous.Scene.isLoaded, "previous Unity scene still loaded");
            previous.Release();
        }
        Index = index; Night = night;
        var data = Bundle.LoadScene(index, night);
        World = new E8World(data);
        World.Interacted += _ =>
        {
            notice = E8InteractionHud.FeedbackFor(data.id);
            noticeUntil = Time.unscaledTimeAsDouble + 1.5;
        };
        if (position.HasValue) World.Place(position.Value);
        Camera.orthographicSize = data.height / (2f * data.pixelsPerUnit);
        Camera.transform.position = new Vector3(data.width / (2f * data.pixelsPerUnit), data.height / (2f * data.pixelsPerUnit), -10);
        movementBudget = 0; walking = false; animationMs = 0;
        loading = false;
        if (AwakeToSceneMs == 0) AwakeToSceneMs = (Time.realtimeSinceStartupAsDouble - awakeAt) * 1000;
        yield return null;
    }

    public void Save(string path)
    {
        var save = new SaveState { revision = Bundle.revision, index = Index, night = Night, x = World.Position.x, y = World.Position.y };
        File.WriteAllText(path, JsonUtility.ToJson(save));
    }

    public IEnumerator Reload(string path)
    {
        var saved = JsonUtility.FromJson<SaveState>(File.ReadAllText(path));
        E8Assets.Check(saved.revision == Bundle.revision, "save revision mismatch");
        yield return Load(saved.index, saved.night, new Vector2Int(saved.x, saved.y));
    }

    public int Animate(bool moving, double deltaMs)
    {
        if (moving != walking) { walking = moving; animationMs = 0; }
        animationMs += deltaMs;
        var clip = moving ? Walk : Idle;
        int frame = clip.FrameAt(animationMs);
        World.Actor.sprite = clip.Sprites[frame];
        return frame;
    }

    void Update()
    {
        if (ProofMode || World == null || loading) return;
        if (Screen.width < Frame.width || Screen.height < Frame.height + E8InteractionHud.Rail)
            Screen.SetResolution(Mathf.Max(Screen.width, Frame.width), Mathf.Max(Screen.height, Frame.height + E8InteractionHud.Rail),
                FullScreenMode.Windowed);
        string savePath = Path.Combine(Application.persistentDataPath, "e8-local-save.json");
        if (Input.GetKeyDown(KeyCode.F5)) Save(savePath);
        if (Input.GetKeyDown(KeyCode.F9) && File.Exists(savePath)) { StartCoroutine(Reload(savePath)); return; }
        if (Input.GetKeyDown(KeyCode.Alpha1)) { StartCoroutine(Load(0, Night)); return; }
        if (Input.GetKeyDown(KeyCode.Alpha2)) { StartCoroutine(Load(1, Night)); return; }
        if (Input.GetKeyDown(KeyCode.Alpha3)) { StartCoroutine(Load(2, Night)); return; }
        if (Input.GetKeyDown(KeyCode.N)) { StartCoroutine(Load(Index, !Night, World.Position)); return; }

        int x = Held(KeyCode.D, KeyCode.RightArrow) - Held(KeyCode.A, KeyCode.LeftArrow);
        int y = Held(KeyCode.S, KeyCode.DownArrow) - Held(KeyCode.W, KeyCode.UpArrow);
        bool moving = false;
        if (x != 0 || y != 0)
        {
            movementBudget = Mathf.Min(4, movementBudget + Time.unscaledDeltaTime * MoveSpeed);
            bool attempted = movementBudget >= 1;
            while (movementBudget >= 1)
            {
                if (x != 0) moving |= World.Step(new Vector2Int(x, 0));
                if (y != 0) moving |= World.Step(new Vector2Int(0, y));
                movementBudget--;
            }
            if (!attempted) moving = walking;
        }
        else movementBudget = 0;
        Animate(moving, Time.unscaledDeltaTime * 1000);
        HandleInteractionPress(Input.GetKeyDown(KeyCode.E));
    }

    public bool HandleInteractionPress(bool pressed) => pressed && !loading && World != null && World.Interact();

    static int Held(KeyCode a, KeyCode b) => Input.GetKey(a) || Input.GetKey(b) ? 1 : 0;

    public void Draw()
    {
        var start = System.Diagnostics.Stopwatch.GetTimestamp();
        Camera.Render();
        LastRenderMs = (float)((System.Diagnostics.Stopwatch.GetTimestamp() - start) * 1000.0 / System.Diagnostics.Stopwatch.Frequency);
    }

    void LateUpdate()
    {
        if (!ProofMode && World != null && !loading) Draw();
    }

    void OnGUI()
    {
        if (Event.current.type != EventType.Repaint || Frame == null) return;
        var viewport = E8InteractionHud.Viewport(Screen.width, Screen.height, Frame.width, Frame.height, out int scale);
        GUI.DrawTexture(viewport, Frame, ScaleMode.StretchToFill, false);
        if ((!ProofMode || ProofOverlay) && !loading && World != null)
            interactionHud.Draw(World.Data, viewport, scale, World.ActiveTarget, Feedback);
    }

    void OnDestroy()
    {
        if (Frame != null) { Frame.Release(); Destroy(Frame); }
        if (Idle != null) foreach (var sprite in Idle.Sprites) Destroy(sprite);
        if (Walk != null) foreach (var sprite in Walk.Sprites) Destroy(sprite);
        World?.Release();
        interactionHud?.Release();
    }
}
