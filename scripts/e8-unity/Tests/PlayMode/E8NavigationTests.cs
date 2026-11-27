using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

public sealed class E8NavigationTests
{
    [UnityTest]
    public IEnumerator MistfenGameplayUsesRealTilemapAndPhysics()
    {
        var world = new E8World(E8Bundle.Load().LoadScene(0, false));
        try
        {
            Assert.IsTrue(world.Tilemap.HasTile(Vector3Int.zero));
            Assert.IsNull(world.ActiveTarget);
            Assert.IsFalse(world.Interact());
            foreach (var probe in world.Data.probes)
            {
                world.Place(probe.from.Point);
                Assert.IsTrue(world.PhysicsBlocked(probe.to.Point), probe.kind);
                Assert.IsFalse(world.Step(probe.to.Point - world.Position), probe.kind);
            }
            world.Place(world.Data.spawn.Point);
            foreach (var step in world.Data.route)
            {
                if (step.Point != world.Position) Assert.IsTrue(world.Step(step.Point - world.Position));
            }
            Assert.AreEqual(world.Data.landmark.stand.Point, world.Position);
            Assert.IsTrue(world.Interact());
            Assert.IsFalse(world.Interact());
            Assert.AreEqual(1, world.Interactions);
            Assert.AreSame(world.Data.landmark, world.ActiveTarget);
            world.Place(world.Data.spawn.Point);
            Assert.IsNull(world.ActiveTarget);
            Assert.IsFalse(world.Interact());
        }
        finally { world.Deactivate(); world.Release(); }
        yield return SceneManager.UnloadSceneAsync(world.Scene);
        Assert.IsFalse(world.Scene.isLoaded);
    }
}
