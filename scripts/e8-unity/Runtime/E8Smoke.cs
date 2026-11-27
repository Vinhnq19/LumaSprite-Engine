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
    }
    [Serializable] sealed class Report
    {
        public string editor, platform, graphics, gpu, cpu, revision;
        public int systemRamMB, screenWidth, screenHeight, width, height, targetFps, ppu;
        public int[] idleDurations, walkDurations;
        public int idleCycleMs, walkCycleMs;
        public bool timingBoundaries;
        public CaseResult[] cases;
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
            timingBoundaries = true,
        };
        var results = new List<CaseResult>();
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
            E8Assets.Check(game.Camera.targetTexture == game.Frame && game.Frame.filterMode == FilterMode.Point &&
                game.Camera.orthographicSize == data.height / 64f && game.Camera.transform.position ==
                new Vector3(data.width / 64f, data.height / 64f, -10), "native camera");
            var initial = Capture(Path.GetFileNameWithoutExtension(row.staticCapture));
            VerifyOrder(world);
            E8Assets.Check(!world.Interact() && !world.Near, "remote interaction reached");
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
                row.apertureStaging = Aperture(data, Capture(Path.GetFileNameWithoutExtension(row.stagingCapture)));
                world.MoveProp("courier", data.aperture.original.Point);
            }
            int sort = world.Actor.sortingOrder;
            var frameTimes = new List<float>();
            var cameraTimes = new List<float>();
            var stepTimes = new List<float>();
            var animationTimes = new List<float>();
            var idle = new HashSet<int>();
            var walk = new HashSet<int>();
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
                frameTimes.Add(Time.unscaledDeltaTime * 1000);
                yield return null;
            }
            row.steps = data.route.Length - 1;
            row.stablePivot = true;
            E8Assets.Check(world.Position == data.landmark.stand.Point && world.Near, "interaction destination");
            row.atDestination = true;
            string emitted = null;
            world.Interacted += name => emitted = name;
            E8Assets.Check(world.Interact() && emitted == data.landmark.kind && world.Interactions == 1, "interaction event");
            row.interactionEvents = world.Interactions; row.interaction = emitted;
            world.Indicator.enabled = true;
            row.routeCapture = data.id + "-" + data.light + "-interaction.png";
            Capture(Path.GetFileNameWithoutExtension(row.routeCapture));
            double stopAfter = Time.realtimeSinceStartupAsDouble + game.Idle.Data.totalDurationMs / 1000.0 + .15;
            do
            {
                idle.Add(game.Animate(false, Time.unscaledDeltaTime * 1000));
                yield return null;
            } while (Time.realtimeSinceStartupAsDouble < stopAfter);
            row.idleFramesSeen = idle.OrderBy(v => v).ToArray(); row.walkFramesSeen = walk.OrderBy(v => v).ToArray();
            E8Assets.Check(idle.Count == game.Idle.Sprites.Length && walk.Count == game.Walk.Sprites.Length, "live animation frame coverage");
            string save = Path.Combine(output, "runtime-save.tmp");
            game.Save(save);
            var expected = world.Position;
            var oldScene = world.Scene;
            var reload = game.Reload(save);
            while (reload.MoveNext()) yield return reload.Current;
            E8Assets.Check(game.World.Position == expected && game.World.Near && !oldScene.isLoaded && game.World.Scene.isLoaded &&
                game.World.Interactions == 0, "Unity unload/reload and save state");
            File.Delete(save);
            row.saveReload = true;
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
        File.WriteAllText(Path.Combine(output, "runtime.json"), JsonUtility.ToJson(report, true));
        Debug.Log("E8_PLAYER_PASS");
        Application.Quit(0);
    }
}
