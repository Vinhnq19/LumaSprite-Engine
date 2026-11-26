using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using UnityEngine;

public sealed class E54Playback : MonoBehaviour
{
    public const int Width = 320, Height = 176, Ppu = 32, Laps = 3;
    public const int CaptureOffsetMs = 205;
    public Camera fixedCamera;
    public SpriteRenderer background;
    public Texture2D[] terrain;

    [Serializable] public sealed class Input
    {
        public string id;
        public SpriteRenderer renderer;
        public Texture2D idle, walk, bridge;
        public TextAsset idleTiming, walkTiming, manifest;
    }
    public Input[] cast;

    [Serializable] public sealed class Cell { public int x, y, w, h; }
    [Serializable] public sealed class Frame { public int durationMs; public string rgbaSha256; public Cell rect; }
    [Serializable] public sealed class Foot { public string state; public int[] canvas, world; }
    [Serializable] public sealed class Feet { public Foot near, far; }
    [Serializable] public sealed class Motion { public int index, rootX, advancePx; public Feet feet; }
    [Serializable] public sealed class Root { public string mode; public int cyclePx; public Motion[] frames; }
    [Serializable] public sealed class Timing { public int[] pivot; public int totalDurationMs; public Frame[] frames; public Root rootMotion; }
    [Serializable] public sealed class Bundle { public Clips clips; }
    [Serializable] public sealed class Clips { public Bridge walk; }
    [Serializable] public sealed class Bridge { public int bridgeMs; }
    sealed class Actor
    {
        public Input input;
        public Timing idle, walk;
        public Sprite[] idleCells, walkCells;
        public Sprite bridge;
        public int bridgeMs;
        public int Enter => idle.totalDurationMs + bridgeMs;
        public int Stop => Enter + Laps * walk.totalDurationMs;
        public int Done => Stop + walk.frames[0].durationMs + bridgeMs + idle.totalDurationMs;
    }
    struct Sample
    {
        public string stage;
        public int frame, cycle, root;
        public double phaseMs;
        public Sprite sprite;
        public Motion motion;
    }
    [Serializable] public sealed class Case
    {
        public string scene, actor, mode;
        public double speed, maxSlipPx, maxFootTickPx;
        public int maxRootTickPx, finalRootPx, footSamples, interiorSamples, probes, wraps;
        public int[] durations, pivot;
    }
    [Serializable] public sealed class Trace
    {
        public double ms, inFrameMs;
        public int tick, cycle, frame, root, nearX, farX, nearSlip, farSlip;
        public bool nearPlanted, farPlanted;
        public string stage;
    }
    [Serializable] public sealed class Capture
    {
        public string file, scene, mode;
        public int atMs;
        public int[] roots, frames, anchorX, anchorY;
    }
    [Serializable] public sealed class Live
    {
        public string scene, mode;
        public double elapsedSeconds, observedFps, p95FrameMs;
        public int renderedTicks;
        public int[] uniqueWalkFrames, finalRoots, maxContactSlipPx;
        public bool[] sawIdleReturn;
    }
    [Serializable] public sealed class Evidence
    {
        public string unity, graphics, platform, renderPipeline;
        public int ppu, width, height, targetFps;
        public Case[] cases;
        public Capture[] captures;
        public Live[] live;
    }
    readonly string[] sceneNames = { "outdoor", "dungeon", "neutral" };
    readonly int[,] xs = { { 38, 77 }, { 38, 79 }, { 38, 77 } };
    readonly int[,] ys = { { 92, 163 }, { 110, 151 }, { 97, 157 } };
    Actor[] actors;
    Sprite[] backgrounds;
    RenderTexture target;
    string output;
    static void Check(bool condition, string error) { if (!condition) throw new InvalidDataException(error); }

    static Sprite CellSprite(Texture2D tex, Cell cell, int[] pivot)
    {
        return Sprite.Create(tex, new Rect(cell.x, tex.height - cell.y - cell.h, cell.w, cell.h),
            new Vector2((float)pivot[0] / cell.w, 1f - (float)pivot[1] / cell.h), Ppu, 0, SpriteMeshType.FullRect);
    }

    static Sprite[] ReadStrip(Texture2D tex, Timing timing)
    {
        Check(tex.width == 64 * timing.frames.Length && tex.height == 64 && tex.filterMode == FilterMode.Point, "Strip dimensions/filter");
        Check(timing.frames.Sum(f => f.durationMs) == timing.totalDurationMs, "Timing sum");
        var pixels = tex.GetPixels32();
        return timing.frames.Select((f, i) => {
            var c = f.rect;
            Check(c.x == i * 64 && c.y == 0 && c.w == 64 && c.h == 64, "Slice order");
            var rgba = new byte[c.w * c.h * 4];
            int at = 0;
            for (int y = 0; y < c.h; y++) for (int x = 0; x < c.w; x++)
            {
                var p = pixels[(tex.height - 1 - c.y - y) * tex.width + c.x + x];
                Check(p.a == 0 || p.a == 255, "Partial alpha");
                rgba[at++] = p.r; rgba[at++] = p.g; rgba[at++] = p.b; rgba[at++] = p.a;
            }
            using (var hash = SHA256.Create())
                Check(BitConverter.ToString(hash.ComputeHash(rgba)).Replace("-", "").ToLowerInvariant() == f.rgbaSha256, "Imported RGBA frame " + i);
            var sprite = CellSprite(tex, c, timing.pivot);
            Check(sprite.pixelsPerUnit == Ppu && sprite.pivot == new Vector2(timing.pivot[0], c.h - timing.pivot[1]), "Sprite pivot/PPU");
            return sprite;
        }).ToArray();
    }

    static int FrameAt(Timing timing, double ms, out double phase)
    {
        for (int i = 0; i < timing.frames.Length; i++)
        {
            var duration = timing.frames[i].durationMs;
            if (ms < duration) { phase = ms; return i; }
            ms -= duration;
        }
        throw new ArgumentOutOfRangeException(nameof(ms));
    }

    static Sample Walk(Actor actor, double time, int cycle, bool snapped)
    {
        var timing = actor.walk;
        var frame = FrameAt(timing, time, out var phase);
        var motion = timing.rootMotion.frames[frame];
        int delta = snapped ? (int)Math.Floor(phase * motion.advancePx / timing.frames[frame].durationMs + .5) : 0;
        return new Sample { stage = "walk", frame = frame, cycle = cycle, phaseMs = phase,
            root = cycle * timing.rootMotion.cyclePx + motion.rootX + delta, motion = motion, sprite = actor.walkCells[frame] };
    }

    static Sample Pose(Actor actor, double ms, bool snapped)
    {
        if (ms < actor.idle.totalDurationMs) return Idle(actor, ms, 0, "idle");
        if (ms < actor.Enter) return new Sample { stage = "entry", sprite = actor.bridge };
        if (ms < actor.Stop)
        {
            double elapsed = ms - actor.Enter;
            int cycle = (int)(elapsed / actor.walk.totalDurationMs);
            return Walk(actor, elapsed - cycle * actor.walk.totalDurationMs, cycle, snapped);
        }
        int root = Laps * actor.walk.rootMotion.cyclePx;
        double sinceStop = ms - actor.Stop;
        if (sinceStop < actor.walk.frames[0].durationMs)
        {
            var hold = Walk(actor, 0, Laps, false);
            hold.stage = "stop-contact";
            return hold;
        }
        sinceStop -= actor.walk.frames[0].durationMs;
        if (sinceStop < actor.bridgeMs) return new Sample { stage = "exit", root = root, sprite = actor.bridge };
        sinceStop -= actor.bridgeMs;
        if (ms < actor.Done) return Idle(actor, sinceStop, root, "idle-return");
        return Idle(actor, 0, root, "done");
    }

    static Sample Idle(Actor actor, double t, int root, string stage)
    {
        var frame = FrameAt(actor.idle, t, out var phase);
        return new Sample { stage = stage, frame = frame, phaseMs = phase, root = root, sprite = actor.idleCells[frame] };
    }

    static bool Planted(Foot foot) => foot?.state == "planted";
    static int FootX(Actor actor, Sample p, Foot f, int x) => f == null ? 0 : x - actor.walk.pivot[0] + p.root + f.canvas[0];
    static int Slip(Actor actor, Sample p, Foot f, int x)
    {
        if (!Planted(f)) return 0;
        Check(f.canvas[1] == f.world[1], "Contact Y drift");
        int ideal = x - actor.walk.pivot[0] + p.cycle * actor.walk.rootMotion.cyclePx + f.world[0];
        return FootX(actor, p, f, x) - ideal;
    }

    Case Probe(int scene, int actorIndex, bool snapped, double speed)
    {
        var actor = actors[actorIndex];
        var timing = actor.walk;
        string mode = snapped ? "B" : "A";
        int anchor = xs[scene, actorIndex];
        var result = new Case { actor = actor.input.id, scene = sceneNames[scene], mode = mode, speed = speed,
            durations = timing.frames.Select(f => f.durationMs).ToArray(), pivot = timing.pivot, wraps = Laps };
        for (int lap = 0; lap < Laps; lap++)
        {
            double offset = actor.Enter + lap * timing.totalDurationMs;
            for (int f = 0; f < timing.frames.Length; f++)
            {
                Check(Pose(actor, offset, snapped).frame == f &&
                    Pose(actor, offset + timing.frames[f].durationMs - .01, snapped).frame == f, "Frame timing boundary");
                offset += timing.frames[f].durationMs;
                result.probes += 2;
            }
        }
        Check(Pose(actor, actor.Enter - 1, snapped).stage == "entry" &&
            Pose(actor, actor.Stop, snapped).stage == "stop-contact" &&
            Pose(actor, actor.Stop + timing.frames[0].durationMs, snapped).stage == "exit" &&
            Pose(actor, actor.Done - 1, snapped).stage == "idle-return", "Journey transitions");
        var trace = new List<Trace>();
        for (int tick = 0; ; tick++)
        {
            double ms = Math.Min(actor.Done, tick * 1000d * speed / 60);
            var p = Pose(actor, ms, snapped);
            var near = p.motion?.feet.near;
            var far = p.motion?.feet.far;
            var row = new Trace { tick = tick, ms = ms, stage = p.stage, inFrameMs = p.phaseMs, frame = p.frame, cycle = p.cycle,
                root = p.root, nearX = FootX(actor, p, near, anchor), farX = FootX(actor, p, far, anchor),
                nearPlanted = Planted(near), farPlanted = Planted(far), nearSlip = Slip(actor, p, near, anchor), farSlip = Slip(actor, p, far, anchor) };
            if (trace.Count > 0)
            {
                var prior = trace[trace.Count - 1];
                Check(p.root >= prior.root, "Root reversed");
                result.maxRootTickPx = Math.Max(result.maxRootTickPx, p.root - prior.root);
                if (row.nearPlanted && prior.nearPlanted)
                    result.maxFootTickPx = Math.Max(result.maxFootTickPx, Math.Abs(row.nearX - prior.nearX));
                if (row.farPlanted && prior.farPlanted)
                    result.maxFootTickPx = Math.Max(result.maxFootTickPx, Math.Abs(row.farX - prior.farX));
            }
            int planted = (row.nearPlanted ? 1 : 0) + (row.farPlanted ? 1 : 0);
            result.footSamples += planted;
            if (p.stage == "walk" && p.phaseMs > .01) result.interiorSamples += planted;
            result.maxSlipPx = Math.Max(result.maxSlipPx, Math.Max(Math.Abs(row.nearSlip), Math.Abs(row.farSlip)));
            trace.Add(row);
            if (p.stage == "done") { result.finalRootPx = p.root; break; }
        }
        Check(result.interiorSamples > 100 && result.finalRootPx == Laps * timing.rootMotion.cyclePx, "Incomplete 60Hz trace");
        if (!snapped) Check(result.maxFootTickPx == 0 && result.maxSlipPx == 0, "Discrete foot slid");
        if (scene == 0 && speed == 1)
            File.WriteAllText(Path.Combine(output, actor.input.id + "-" + mode + "-trace.json"), JsonUtility.ToJson(new TraceSet { samples = trace.ToArray() }));
        return result;
    }
    [Serializable] sealed class TraceSet { public Trace[] samples; }

    Sample[] Render(int scene, bool snapped, double ms)
    {
        background.sprite = backgrounds[scene];
        var samples = new Sample[actors.Length];
        for (int i = 0; i < actors.Length; i++)
        {
            var p = Pose(actors[i], ms, snapped);
            var r = actors[i].input.renderer;
            r.sprite = p.sprite;
            r.transform.position = new Vector3((xs[scene, i] + p.root) / (float)Ppu, (Height - ys[scene, i]) / (float)Ppu, 0);
            samples[i] = p;
        }
        return samples;
    }

    Capture Snap(int scene, bool snapped)
    {
        var mode = snapped ? "B" : "A";
        int ms = actors[0].Enter + CaptureOffsetMs;
        var poses = Render(scene, snapped, ms);
        var previous = RenderTexture.active;
        fixedCamera.targetTexture = target;
        fixedCamera.Render();
        RenderTexture.active = target;
        var image = new Texture2D(Width, Height, TextureFormat.RGBA32, false);
        image.ReadPixels(new Rect(0, 0, Width, Height), 0, 0);
        image.Apply();
        var file = sceneNames[scene] + "-" + mode + ".png";
        File.WriteAllBytes(Path.Combine(output, file), image.EncodeToPNG());
        Destroy(image);
        RenderTexture.active = previous;
        fixedCamera.targetTexture = null;
        return new Capture { file = file, scene = sceneNames[scene], mode = mode, atMs = ms,
            roots = poses.Select(x => x.root).ToArray(), frames = poses.Select(x => x.frame).ToArray(),
            anchorX = new[] { xs[scene, 0], xs[scene, 1] }, anchorY = new[] { ys[scene, 0], ys[scene, 1] } };
    }

    IEnumerator RunLive(int scene, bool snapped, Live proof)
    {
        proof.scene = sceneNames[scene]; proof.mode = snapped ? "B" : "A";
        proof.sawIdleReturn = new bool[2];
        proof.maxContactSlipPx = new int[2];
        var unique = new[] { new HashSet<int>(), new HashSet<int>() };
        var intervals = new List<double>();
        yield return null;
        double start = Time.realtimeSinceStartupAsDouble, last = start;
        while (true)
        {
            double now = Time.realtimeSinceStartupAsDouble;
            double ms = (now - start) * 1000;
            if (now != last) intervals.Add((now - last) * 1000);
            last = now;
            var p = Render(scene, snapped, ms);
            for (int i = 0; i < p.Length; i++)
            {
                if (p[i].stage == "idle-return") proof.sawIdleReturn[i] = true;
                if (p[i].stage != "walk") continue;
                unique[i].Add(p[i].cycle * actors[i].walk.frames.Length + p[i].frame);
                int excursion = Math.Max(Math.Abs(Slip(actors[i], p[i], p[i].motion.feet.near, xs[scene, i])),
                    Math.Abs(Slip(actors[i], p[i], p[i].motion.feet.far, xs[scene, i])));
                proof.maxContactSlipPx[i] = Math.Max(proof.maxContactSlipPx[i], excursion);
            }
            if (p.All(x => x.stage == "done"))
            {
                proof.finalRoots = p.Select(x => x.root).ToArray();
                proof.elapsedSeconds = now - start;
                break;
            }
            yield return null;
        }
        proof.uniqueWalkFrames = unique.Select(x => x.Count).ToArray();
        proof.renderedTicks = intervals.Count;
        proof.observedFps = intervals.Count / proof.elapsedSeconds;
        intervals.Sort();
        proof.p95FrameMs = intervals[(int)((intervals.Count - 1) * .95)];
        Check(proof.sawIdleReturn.All(x => x) && proof.uniqueWalkFrames.All(x => x == Laps * 8), "Live playback skipped an authored pose");
    }

    IEnumerator Start()
    {
        var args = Environment.GetCommandLineArgs();
        int index = Array.IndexOf(args, "-e54-proof");
        if (index < 0)
        {
            Debug.LogError("Provide -e54-proof <output directory>.");
            Application.Quit(2);
            yield break;
        }
        output = args[index + 1];
        Directory.CreateDirectory(output);
        Application.runInBackground = true;
        Application.targetFrameRate = 60;
        QualitySettings.vSyncCount = 0;
        Check(SystemInfo.graphicsDeviceType != UnityEngine.Rendering.GraphicsDeviceType.Null, "Graphics runtime required");
        actors = cast.Select(input => {
            var idle = JsonUtility.FromJson<Timing>(input.idleTiming.text);
            var walk = JsonUtility.FromJson<Timing>(input.walkTiming.text);
            Check(idle.pivot.SequenceEqual(walk.pivot) && walk.rootMotion.mode == "frame-stepped", "Pivot/Root contract");
            int cumulative = 0;
            foreach (var motion in walk.rootMotion.frames)
            {
                Check(motion.rootX == cumulative, "Root increment");
                cumulative += motion.advancePx;
            }
            Check(cumulative == walk.rootMotion.cyclePx, "Root cycle");
            return new Actor { input = input, idle = idle, walk = walk, idleCells = ReadStrip(input.idle, idle),
                walkCells = ReadStrip(input.walk, walk), bridgeMs = JsonUtility.FromJson<Bundle>(input.manifest.text).clips.walk.bridgeMs,
                bridge = CellSprite(input.bridge, new Cell { x = 0, y = 0, w = 64, h = 64 }, walk.pivot) };
        }).ToArray();
        backgrounds = terrain.Select(tex => CellSprite(tex, new Cell { x = 0, y = 0, w = Width, h = Height }, new[] { 0, Height })).ToArray();
        target = new RenderTexture(Width, Height, 0, RenderTextureFormat.ARGB32) { filterMode = FilterMode.Point, antiAliasing = 1 };
        Check(fixedCamera.orthographic && fixedCamera.orthographicSize == Height / (2f * Ppu) &&
              fixedCamera.transform.position == new Vector3(Width / (2f * Ppu), Height / (2f * Ppu), -10), "Camera grid");
        var cases = new List<Case>();
        var captures = new List<Capture>();
        var live = new List<Live>();
        for (int scene = 0; scene < terrain.Length; scene++) foreach (bool snapped in new[] { false, true })
        {
            for (int actor = 0; actor < actors.Length; actor++) foreach (double speed in new[] { .75, 1d, 1.25 })
                cases.Add(Probe(scene, actor, snapped, speed));
            captures.Add(Snap(scene, snapped));
        }
        for (int scene = 0; scene < 2; scene++) foreach (bool snapped in new[] { false, true })
        {
            var result = new Live();
            yield return RunLive(scene, snapped, result);
            live.Add(result);
        }
        var evidence = new Evidence { unity = Application.unityVersion, platform = Application.platform.ToString(),
            graphics = SystemInfo.graphicsDeviceType.ToString(), renderPipeline = "Built-in", ppu = Ppu, width = Width, height = Height,
            targetFps = Application.targetFrameRate, cases = cases.ToArray(), captures = captures.ToArray(), live = live.ToArray() };
        File.WriteAllText(Path.Combine(output, "runtime.json"), JsonUtility.ToJson(evidence, true));
        Debug.Log("E54_PLAYER_PASS");
        Application.Quit(0);
    }
}
