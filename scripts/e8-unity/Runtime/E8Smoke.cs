using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.Profiling;
using Debug = UnityEngine.Debug;

public sealed class E8Smoke
{
    [Serializable] sealed class ProbeResult { public string kind, collider; public E8Pixel from, to; public bool physics, rejected; }
    [Serializable] sealed class CaseResult
    {
        public string id, light, staticCapture, routeCapture, interaction, stagingCapture;
        public int steps, atlasCells, interactionEvents, apertureVisible, apertureStaging, apertureThreshold, sortOrderChanges;
        public bool atDestination, saveReload, colliderAgreement, stablePivot, reachRejectsRemote, dayNightAligned;
        public int[] idleFramesSeen, walkFramesSeen;
        public float loadMs, tilemapBuildMs, meanFrameMs, p95FrameMs, meanCameraSubmitMs, meanStepMs, meanAnimationSubmitMs;
        public long allocatedBytes, reservedBytes;
        public ProbeResult[] probes;
        public string outOfRangeCapture, promptCapture, feedbackCapture;
        public string prompt, feedback, stagingInteraction;
        public E8Pixel marker, stand;
        public bool sharedPress, duplicateRejected, promptLeavesRange, promptReset, feedbackResets, feedbackExpires;
        public bool stagingWalkable, stagingDepth, stagingPath;
        public float warmupMs, steadyMeanMs, steadyP95Ms, steadyMaxMs, firstMovementFrameMs, captureMs, switchMs;
        public int steadyFrames, spikesOver25ms, garbageCollections;
    }
    [Serializable] sealed class AnimationFrame
    {
        public string file, stage, nearState, farState;
        public int frame, atMs, durationMs, authoredRootX, plantedFeet;
        public E8Pixel position;
    }

    [Serializable] sealed class Report
    {
        public string editor, platform, graphics, gpu, cpu, revision;
        public int systemRamMB, screenWidth, screenHeight, width, height, targetFps, ppu;
        public int[] idleDurations, walkDurations;
        public int idleCycleMs, walkCycleMs;
        public bool timingBoundaries;
        public CaseResult[] cases;
        public AnimationFrame[] animation;
        public double startupToAwakeMs, awakeToSceneMs, processToFirstWorldCaptureMs;
        public string performanceClock, facing;
    }

    readonly E8Game game;
    readonly string output;
    public E8Smoke(E8Game game, string output) { this.game = game; this.output = output; }

    public IEnumerator Run()
    {
        Directory.CreateDirectory(output);
        var routine = Cases();
        while (true)
        {
            object current;
            try
            {
                if (!routine.MoveNext()) break;
                current = routine.Current;
            }
            catch (Exception error)
            {
                File.WriteAllText(Path.Combine(output, "unity-failure.txt"), error.ToString());
                Debug.LogException(error);
                Application.Quit(1);
                yield break;
            }
            yield return current;
        }
    }

    static void CheckTiming(E8Animation clip)
    {
        double start = 0;
        for (int f = 0; f < clip.Data.frames.Length; f++)
        {
            E8Assets.Check(clip.FrameAt(start) == f &&
                clip.FrameAt(start + clip.Data.frames[f].durationMs - .001) == f, "manifest timing boundary");
            start += clip.Data.frames[f].durationMs;
        }
        E8Assets.Check(clip.FrameAt(start) == 0, "animation loop");
    }

    Color32[] Capture(string name)
    {
        game.Draw();
        var prior = RenderTexture.active;
        RenderTexture.active = game.Frame;
        var view = new Texture2D(game.Frame.width, game.Frame.height, TextureFormat.RGBA32, false);
        view.ReadPixels(new Rect(0, 0, game.Frame.width, game.Frame.height), 0, 0, false);
        view.Apply(false);
        var pixels = view.GetPixels32();
        if (name != null) File.WriteAllBytes(Path.Combine(output, name + ".png"), view.EncodeToPNG());
        UnityEngine.Object.Destroy(view);
        RenderTexture.active = prior;
        return pixels;
    }

    IEnumerator ScreenShot(string file, CaseResult row)
    {
        game.Draw();
        game.ProofOverlay = true;
        yield return new WaitForEndOfFrame();
        var clock = Stopwatch.StartNew();
        var screen = ScreenCapture.CaptureScreenshotAsTexture();
        E8Assets.Check(screen.width == Screen.width && screen.height == Screen.height, "screen capture dimensions");
        File.WriteAllBytes(Path.Combine(output, file), screen.EncodeToPNG());
        UnityEngine.Object.Destroy(screen);
        row.captureMs += (float)clock.Elapsed.TotalMilliseconds;
        game.ProofOverlay = false;
    }

    static float Percentile(List<float> values, double fraction)
    {
        var ordered = values.OrderBy(value => value).ToArray();
        return ordered[(int)Math.Floor((ordered.Length - 1) * fraction)];
    }

    static int Aperture(E8SceneData data, Color32[] frame)
    {
        var a = data.aperture;
        var inks = new HashSet<uint>();
        foreach (string hue in a.water) inks.Add(Convert.ToUInt32(hue.Substring(1), 16));
        int count = 0;
        for (int y = a.y; y < a.y + a.h; y++) for (int x = a.x; x < a.x + a.w; x++)
        {
            var color = frame[(data.height - 1 - y) * data.width + x];
            if (inks.Contains(((uint)color.r << 16) | ((uint)color.g << 8) | color.b)) count++;
        }
        return count;
    }

    void VerifyOrder(E8World world)
    {
        var row = Array.Find(world.Data.layers, layer => layer.id == "surveyor");
        E8Assets.Check(world.Actor.sortingOrder == E8World.Order(world.Position.y, row.order) &&
            world.Actor.transform.position == world.Data.World(world.Position), "pixel alignment and depth sort");
        foreach (var layer in world.Data.layers)
        {
            if (layer.id == "surveyor") continue;
            var sprite = world.Objects[layer.id];
            E8Assets.Check(sprite.sortingOrder == E8World.Order(layer.at.y, layer.order),
                "unchanged static layer order " + layer.id);
        }
    }

    IEnumerator Cases()
    {
        CheckTiming(game.Idle); CheckTiming(game.Walk);
        var report = new Report {
            editor = Application.unityVersion, platform = Application.platform.ToString(), graphics = SystemInfo.graphicsDeviceType.ToString(),
            gpu = SystemInfo.graphicsDeviceName, cpu = SystemInfo.processorType, revision = game.Bundle.revision, systemRamMB = SystemInfo.systemMemorySize,
            screenWidth = Screen.width, screenHeight = Screen.height, width = game.Frame.width, height = game.Frame.height, ppu = 32,
            targetFps = Application.targetFrameRate, idleCycleMs = game.Idle.Data.totalDurationMs, walkCycleMs = game.Walk.Data.totalDurationMs,
            idleDurations = game.Idle.Data.frames.Select(f => f.durationMs).ToArray(), walkDurations = game.Walk.Data.frames.Select(f => f.durationMs).ToArray(),
            timingBoundaries = true, startupToAwakeMs = game.StartupToAwakeMs,
            performanceClock = "Windows process start and Unity real-time frame intervals",
            facing = "Existing E5 one-way sheet. Cardinal movement does not select a new directional sprite."
        };
        var results = new List<CaseResult>();
        var animation = new List<AnimationFrame>();
        for (int index = 0; index < game.Bundle.cases.Length; index++) for (int time = 0; time < 2; time++)
        {
            var clock = Stopwatch.StartNew();
            var loading = game.Load(index, time != 0);
            while (loading.MoveNext()) yield return loading.Current;
            var world = game.World;
            var data = world.Data;
            var row = new CaseResult { id = data.id, light = data.light, loadMs = (float)clock.Elapsed.TotalMilliseconds,
                atlasCells = data.tiles.ids.Length, tilemapBuildMs = world.TilemapBuildMs, apertureVisible = -1, apertureStaging = -1, apertureThreshold = -1,
                staticCapture = data.id + "-" + data.light + "-spawn.png" };
            string prefix = data.id + "-" + data.light;
            row.switchMs = results.Count == 0 ? 0 : row.loadMs;
            row.marker = new E8Pixel { x = E8InteractionHud.MarkerPixel(data, data.landmark).x, y = E8InteractionHud.MarkerPixel(data, data.landmark).y };
            row.stand = data.landmark.stand;
            E8Assets.Check(game.Camera.targetTexture == game.Frame && game.Frame.filterMode == FilterMode.Point &&
                game.Camera.orthographicSize == data.height / 64f && game.Camera.transform.position ==
                new Vector3(data.width / 64f, data.height / 64f, -10), "native camera");
            for (int i = 0; i < 45; i++)
            {
                game.Draw();
                yield return null;
            }
            row.warmupMs = (float)clock.Elapsed.TotalMilliseconds - row.loadMs;
            var captureClock = Stopwatch.StartNew();
            var initial = Capture(Path.GetFileNameWithoutExtension(row.staticCapture));
            row.captureMs = (float)captureClock.Elapsed.TotalMilliseconds;
            if (results.Count == 0)
            {
                report.awakeToSceneMs = game.AwakeToSceneMs;
                report.processToFirstWorldCaptureMs = game.ProcessUptimeMs;
            }
            VerifyOrder(world);
            E8Assets.Check(!game.HandleInteractionPress(true) && !world.Near && game.Feedback == "", "remote interaction reached");
            row.outOfRangeCapture = prefix + "-discover.png";
            var outside = ScreenShot(row.outOfRangeCapture, row);
            while (outside.MoveNext()) yield return outside.Current;
            row.reachRejectsRemote = true;
            var probes = new List<ProbeResult>();
            foreach (var probe in data.probes)
            {
                world.Place(probe.from.Point);
                bool physics = world.PhysicsBlocked(probe.to.Point);
                bool reject = !world.Step(probe.to.Point - probe.from.Point);
                E8Assets.Check(physics && reject && world.Position == probe.from.Point, "collider " + probe.kind);
                probes.Add(new ProbeResult { kind = probe.kind, collider = probe.collider, from = probe.from, to = probe.to,
                    physics = physics, rejected = reject });
            }
            row.probes = probes.ToArray(); row.colliderAgreement = true;
            world.Place(data.spawn.Point);
            if (data.id == "canal-intake-service-platform")
            {
                row.apertureVisible = Aperture(data, initial);
                row.apertureThreshold = data.aperture.threshold;
                E8Assets.Check(row.apertureVisible == data.aperture.expected && row.apertureVisible < row.apertureThreshold,
                    "locked Canal known failure changed: " + row.apertureVisible);
                E8Assets.Check(data.Fits(data.aperture.staging.Point) && !world.PhysicsBlocked(data.aperture.staging.Point), "staging location blocked");
                world.MoveProp("courier", data.aperture.staging.Point);
                row.stagingCapture = data.id + "-" + data.light + "-staging.png";
                captureClock.Restart();
                row.apertureStaging = Aperture(data, Capture(Path.GetFileNameWithoutExtension(row.stagingCapture)));
                row.captureMs += (float)captureClock.Elapsed.TotalMilliseconds;
                row.stagingWalkable = true;
                var courier = Array.Find(data.layers, layer => layer.id == "courier");
                row.stagingDepth = world.Objects["courier"].sortingOrder == E8World.Order(data.aperture.staging.y, courier.order);
                E8Assets.Check(row.stagingDepth && row.apertureStaging == data.aperture.w * data.aperture.h, "staging depth or water ROI");
                foreach (var node in data.route)
                    if (node.Point != world.Position) E8Assets.Check(world.Step(node.Point - world.Position), "staging route blocked");
                E8Assets.Check(game.HandleInteractionPress(true), "staging interaction");
                row.stagingInteraction = data.landmark.kind;
                row.stagingPath = world.Near;
                E8Assets.Check(row.stagingPath, "staging reach");
                yield return null;
                var reloadStaging = game.Load(index, time != 0);
                while (reloadStaging.MoveNext()) yield return reloadStaging.Current;
                world = game.World;
                E8Assets.Check(game.Feedback == "" && !world.Near &&
                    world.Objects["courier"].transform.position == data.World(data.aperture.original.Point), "staging cleanup and restored original");
                for (int i = 0; i < 8; i++) { game.Draw(); yield return null; }
            }
            int sort = world.Actor.sortingOrder;
            var frameTimes = new List<float>();
            var cameraTimes = new List<float>();
            var stepTimes = new List<float>();
            var animationTimes = new List<float>();
            var idle = new HashSet<int>();
            var walk = new HashSet<int>();
            var steady = new List<float>();
            var initialGc = GC.CollectionCount(0) + GC.CollectionCount(1) + GC.CollectionCount(2);
            double last = Time.realtimeSinceStartupAsDouble;
            for (int p = 1; p < data.route.Length; p++)
            {
                var watch = Stopwatch.StartNew();
                E8Assets.Check(world.Step(data.route[p].Point - world.Position), "route denied at " + p);
                stepTimes.Add((float)watch.Elapsed.TotalMilliseconds);
                VerifyOrder(world);
                if (world.Actor.sortingOrder != sort) { row.sortOrderChanges++; sort = world.Actor.sortingOrder; }
                watch.Restart();
                walk.Add(game.Animate(true, Time.unscaledDeltaTime * 1000));
                animationTimes.Add((float)watch.Elapsed.TotalMilliseconds);
                game.Draw();
                cameraTimes.Add(game.LastRenderMs);
                yield return null;
                double now = Time.realtimeSinceStartupAsDouble;
                var interval = (float)((now - last) * 1000);
                last = now;
                frameTimes.Add(interval);
                if (p == 1) row.firstMovementFrameMs = interval;
                if (p > 10) steady.Add(interval);
            }
            row.steps = data.route.Length - 1;
            row.stablePivot = true;
            E8Assets.Check(world.Position == data.landmark.stand.Point && world.Near, "interaction destination");
            row.atDestination = true;
            string emitted = null;
            world.Interacted += name => emitted = name;
            row.garbageCollections = GC.CollectionCount(0) + GC.CollectionCount(1) + GC.CollectionCount(2) - initialGc;
            row.steadyFrames = steady.Count;
            row.steadyMeanMs = steady.Average();
            row.steadyP95Ms = Percentile(steady, .95);
            row.steadyMaxMs = steady.Max();
            row.spikesOver25ms = steady.Count(v => v > 25);

            row.prompt = "E · " + E8InteractionHud.PromptFor(data.id);
            row.promptCapture = prefix + "-prompt.png";
            E8Assets.Check(world.ActiveTarget == world.Data.landmark && !game.HandleInteractionPress(false) && game.Feedback == "", "prompt eligibility");
            var prompt = ScreenShot(row.promptCapture, row);
            while (prompt.MoveNext()) yield return prompt.Current;
            row.sharedPress = game.HandleInteractionPress(true);
            row.duplicateRejected = !game.HandleInteractionPress(true);
            E8Assets.Check(row.sharedPress && row.duplicateRejected && emitted == data.landmark.kind && world.Interactions == 1, "one event per press");
            row.feedback = E8InteractionHud.FeedbackFor(data.id);
            E8Assets.Check(game.Feedback == row.feedback, "feedback text");
            row.feedbackCapture = prefix + "-feedback.png";
            var feedback = ScreenShot(row.feedbackCapture, row);
            while (feedback.MoveNext()) yield return feedback.Current;
            row.interactionEvents = world.Interactions; row.interaction = emitted;

            row.routeCapture = data.id + "-" + data.light + "-interaction.png";
            captureClock.Restart();
            Capture(Path.GetFileNameWithoutExtension(row.routeCapture));
            row.captureMs += (float)captureClock.Elapsed.TotalMilliseconds;
            world.Place(data.spawn.Point);
            row.promptLeavesRange = !world.Near && !game.HandleInteractionPress(true);
            E8Assets.Check(row.promptLeavesRange && world.Interactions == 1, "prompt turns off after exit");
            world.Place(data.landmark.stand.Point);
            double stopAfter = Time.realtimeSinceStartupAsDouble + game.Idle.Data.totalDurationMs / 1000.0 + .15;
            do
            {
                idle.Add(game.Animate(false, Time.unscaledDeltaTime * 1000));
                yield return null;
            } while (Time.realtimeSinceStartupAsDouble < stopAfter);
            row.feedbackExpires = game.Feedback == "";
            E8Assets.Check(row.feedbackExpires, "feedback expires");
            row.idleFramesSeen = idle.OrderBy(v => v).ToArray(); row.walkFramesSeen = walk.OrderBy(v => v).ToArray();
            E8Assets.Check(idle.Count == game.Idle.Sprites.Length && walk.Count == game.Walk.Sprites.Length, "live animation frame coverage");
            string save = Path.Combine(output, "runtime-save.tmp");
            game.Save(save);
            var expected = world.Position;
            var oldScene = world.Scene;
            // Return to another real Unity scene before restoring the saved position and light.
            E8Assets.Check(game.HandleInteractionPress(true), "pre-switch feedback");
            var switchWorld = game.Load((index + 1) % game.Bundle.cases.Length, time == 0);
            while (switchWorld.MoveNext()) yield return switchWorld.Current;
            row.promptReset = !game.World.Near && game.Feedback == "";
            E8Assets.Check(row.promptReset, "old interaction leaked across scene");
            var reload = game.Reload(save);
            while (reload.MoveNext()) yield return reload.Current;
            E8Assets.Check(game.World.Position == expected && game.World.Near && !oldScene.isLoaded && game.World.Scene.isLoaded &&
                game.World.Interactions == 0, "Unity unload/reload and save state");
            File.Delete(save);
            row.saveReload = true;
            row.feedbackResets = game.Feedback == "" && game.World.ActiveTarget == game.World.Data.landmark;
            E8Assets.Check(row.feedbackResets, "reloaded prompt state");
            if (index == 0 && time == 0)
            {
                var sequence = CaptureAnimation(animation);
                while (sequence.MoveNext()) yield return sequence.Current;
            }
            var normalized = frameTimes.OrderBy(x => x).ToArray();
            row.meanFrameMs = frameTimes.Average();
            row.p95FrameMs = normalized[(int)Math.Floor((normalized.Length - 1) * .95)];
            row.meanCameraSubmitMs = cameraTimes.Average(); row.meanStepMs = stepTimes.Average(); row.meanAnimationSubmitMs = animationTimes.Average();
            row.allocatedBytes = Profiler.GetTotalAllocatedMemoryLong(); row.reservedBytes = Profiler.GetTotalReservedMemoryLong();
            if (time == 1)
            {
                var day = results[results.Count - 1];
                row.dayNightAligned = row.steps == day.steps && row.atlasCells == day.atlasCells && row.probes.Length == day.probes.Length;
                day.dayNightAligned = row.dayNightAligned;
                E8Assets.Check(row.dayNightAligned, "day/night layout changed");
            }
            results.Add(row);
            Debug.Log("E8_CASE_PASS " + data.id + " " + data.light + " " + row.steps + " steps");
        }
        report.cases = results.ToArray();
        report.animation = animation.ToArray();
        File.WriteAllText(Path.Combine(output, "runtime.json"), JsonUtility.ToJson(report, true));
        Debug.Log("E8_PLAYER_PASS");
        Application.Quit(0);
    }
    IEnumerator CaptureAnimation(List<AnimationFrame> evidence)
    {
        var world = game.World;
        var start = world.Data.spawn.Point;
        world.Place(start);
        var walk = game.Walk;
        var model = walk.Data.rootMotion;
        E8Assets.Check(model.frames.Length == walk.Sprites.Length &&
            game.Idle.Data.pivot.SequenceEqual(walk.Data.pivot), "shared gameplay animation pivot");
        int elapsed = 0;
        game.Animate(false, 0);
        for (int i = 0; i <= walk.Sprites.Length; i++)
        {
            int index = i % walk.Sprites.Length;
            var motion = model.frames[index];
            int root = i == walk.Sprites.Length ? model.cyclePx : motion.rootX;
            while (world.Position.x < start.x + root)
                E8Assets.Check(world.Step(Vector2Int.right), "animation sample route");
            int frame = game.Animate(true, i == 0 ? 0 : walk.Data.frames[(i - 1) % walk.Sprites.Length].durationMs);
            E8Assets.Check(frame == index && motion.index == index && world.Actor.sprite == walk.Sprites[index], "runtime shot cadence");
            int painted = 0;
            foreach (var foot in new[] { motion.feet.near, motion.feet.far })
                if (foot.state == "planted")
                {
                    var sprite = walk.Sprites[index];
                    int x = (int)sprite.rect.x + foot.canvas[0], y = (int)sprite.rect.y + (int)sprite.rect.height - foot.canvas[1];
                    E8Assets.Check(foot.clearance == 0 && foot.canvas[1] == foot.groundY && foot.canvas[0] + motion.rootX == foot.world[0],
                        "authored planted-foot contact");
                    E8Assets.Check(sprite.texture.GetPixel(x, y).a > 0, "planted sole absent from imported sprite");
                    painted++;
                }
            var file = "animation-" + i.ToString("00");
            Capture(file);
            evidence.Add(new AnimationFrame { file = file + ".png", stage = i == walk.Sprites.Length ? "loop" : "walk",
                frame = frame, atMs = elapsed, authoredRootX = root, durationMs = walk.Data.frames[index].durationMs,
                nearState = motion.feet.near.state, farState = motion.feet.far.state, plantedFeet = painted,
                position = new E8Pixel { x = world.Position.x, y = world.Position.y } });
            elapsed += walk.Data.frames[index].durationMs;
            yield return null;
        }
        var before = world.Position;
        int idle = game.Animate(false, 0);
        E8Assets.Check(idle == 0 && world.Position == before && world.Actor.sprite.pivot == walk.Sprites[0].pivot, "walk-to-idle contact pivot");
        Capture("animation-idle-return");
        evidence.Add(new AnimationFrame { file = "animation-idle-return.png", stage = "idle-return", frame = idle,
            atMs = model.frames.Length > 0 ? walk.Data.totalDurationMs : 0, durationMs = game.Idle.Data.frames[0].durationMs,
            position = new E8Pixel { x = before.x, y = before.y } });
    }
}