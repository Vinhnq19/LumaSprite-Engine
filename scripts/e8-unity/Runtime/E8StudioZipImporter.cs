using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;

public sealed class ImportedStudioScene
{
    public string SceneId, Light, SceneKey, ResourceSubdir, ZipName, ZipSha256;
    public string SourceRevision, ProtectedSha256, ApprovalStatus, ApprovalNote;
    public string InteractionId, InteractionLabel, LinkedEntityId;
    public int StudioRevision, SpawnX, SpawnY, StandX, StandY;
    public string SceneJsonResourcePath;
}

public static class E8StudioZipImporter
{
    public const int MaxZipBytes = 64 * 1024 * 1024;
    public const int MaxEntries = 256;

    public static string Sha256Hex(byte[] data)
    {
        using var sha = SHA256.Create();
        var hash = sha.ComputeHash(data);
        var sb = new StringBuilder(64);
        foreach (byte b in hash) sb.Append(b.ToString("x2", CultureInfo.InvariantCulture));
        return sb.ToString();
    }

    public static Dictionary<string, byte[]> ReadZip(byte[] zipBytes)
    {
        E8Assets.Check(zipBytes != null && zipBytes.Length >= 22 && zipBytes.Length <= MaxZipBytes, "ZIP_BOUNDS");
        var entries = new Dictionary<string, byte[]>(StringComparer.Ordinal);
        using var ms = new MemoryStream(zipBytes, false);
        using var br = new BinaryReader(ms, Encoding.UTF8, true);
        int count = 0;
        while (ms.Position + 4 <= ms.Length)
        {
            uint sig = br.ReadUInt32();
            if (sig == 0x02014b50 || sig == 0x06054b50) break;
            E8Assets.Check(sig == 0x04034b50, "ZIP_LOCAL_HEADER");
            E8Assets.Check(++count <= MaxEntries, "ZIP_ENTRY_LIMIT");
            br.ReadUInt16(); // version needed
            ushort flags = br.ReadUInt16();
            E8Assets.Check((flags & 0x08) == 0, "ZIP_DATA_DESCRIPTOR_UNSUPPORTED");
            ushort method = br.ReadUInt16();
            br.ReadUInt16(); br.ReadUInt16(); // mod time/date
            br.ReadUInt32(); // crc32
            uint compSize = br.ReadUInt32();
            uint uncompSize = br.ReadUInt32();
            ushort nameLen = br.ReadUInt16();
            ushort extraLen = br.ReadUInt16();
            E8Assets.Check(nameLen > 0 && uncompSize <= 32 * 1024 * 1024 && ms.Position + nameLen + extraLen + compSize <= ms.Length, "ZIP_ENTRY_BOUNDS");
            string name = Encoding.UTF8.GetString(br.ReadBytes(nameLen));
            if (extraLen > 0) br.ReadBytes(extraLen);
            byte[] payload = br.ReadBytes((int)compSize);
            ValidateZipEntryPath(name);
            E8Assets.Check(!entries.ContainsKey(name), "ZIP_DUPLICATE_ENTRY " + name);
            if (method == 0)
            {
                E8Assets.Check(compSize == uncompSize, "ZIP_STORE_SIZE");
                entries[name] = payload;
            }
            else if (method == 8)
            {
                using var cms = new MemoryStream(payload, false);
                using var ds = new DeflateStream(cms, CompressionMode.Decompress);
                using var outMs = new MemoryStream((int)uncompSize);
                ds.CopyTo(outMs);
                var raw = outMs.ToArray();
                E8Assets.Check(raw.Length == uncompSize, "ZIP_DEFLATE_SIZE");
                entries[name] = raw;
            }
            else
            {
                throw new InvalidDataException("E8: ZIP_COMPRESSION_UNSUPPORTED " + method);
            }
        }
        return entries;
    }

    public static void ValidateZipEntryPath(string path)
    {
        E8Assets.Check(!string.IsNullOrEmpty(path) && !path.StartsWith("/") && !path.StartsWith("\\") &&
            !path.Contains("\\") && !path.Contains(":"), "ZIP_PATH_TRAVERSAL " + path);
        foreach (string seg in path.Split('/'))
            E8Assets.Check(seg.Length > 0 && seg != "." && seg != "..", "ZIP_PATH_TRAVERSAL " + path);
    }

    static void ValidatePngBounds(byte[] bytes, string label)
    {
        E8Assets.Check(bytes != null && bytes.Length >= 33 && bytes[0] == 137 && bytes[1] == 80 && bytes[2] == 78 && bytes[3] == 71,
            "INVALID_PNG " + label);
        int w = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
        int h = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
        E8Assets.Check(w >= 1 && w <= 4096 && h >= 1 && h <= 4096 && (long)w * h <= 16_777_216, "PNG_BOUNDS " + label);
    }

    public static ImportedStudioScene ImportZipToDirectory(
        string zipPath,
        string resourcesRoot,
        string targetSubdirOverride = null,
        bool requireApproved = true)
    {
        E8Assets.Check(File.Exists(zipPath), "STUDIO_ZIP_MISSING " + zipPath);
        byte[] zipBytes = File.ReadAllBytes(zipPath);
        string zipSha = Sha256Hex(zipBytes);
        string zipName = Path.GetFileName(zipPath);
        var entries = ReadZip(zipBytes);

        E8Assets.Check(entries.TryGetValue("export-manifest.json", out byte[] manifestBytes), "MISSING_EXPORT_MANIFEST");
        E8Assets.Check(entries.TryGetValue("studio-scene-sidecar.json", out byte[] sidecarBytes), "MISSING_STUDIO_SIDECAR");

        var manifest = Json.Parse(Encoding.UTF8.GetString(manifestBytes)) as Dictionary<string, object>;
        E8Assets.Check(manifest != null && Json.Int(manifest, "version") == 1, "INVALID_EXPORT_MANIFEST");
        string sceneKey = Json.Str(manifest, "sceneKey");
        string light = Json.Str(manifest, "light");
        string packageFormat = Json.Str(manifest, "packageFormat");
        E8Assets.Check(packageFormat == "e8-runtime", "UNSUPPORTED_UNITY_PACKAGE_FORMAT " + packageFormat);

        var fileHashes = Json.Obj(manifest, "fileHashes");
        E8Assets.Check(fileHashes != null && fileHashes.Count > 0, "MISSING_MANIFEST_FILE_HASHES");
        foreach (var kv in fileHashes)
        {
            ValidateZipEntryPath(kv.Key);
            E8Assets.Check(entries.TryGetValue(kv.Key, out byte[] entryBytes), "MISSING_ASSET " + kv.Key);
            E8Assets.Check(string.Equals(Sha256Hex(entryBytes), kv.Value as string, StringComparison.Ordinal),
                "MANIFEST_HASH_MISMATCH " + kv.Key);
        }

        var sidecar = Json.Parse(Encoding.UTF8.GetString(sidecarBytes)) as Dictionary<string, object>;
        E8Assets.Check(sidecar != null && Json.Int(sidecar, "schemaVersion") == 1, "UNSUPPORTED_SCHEMA_VERSION");
        var rec = Json.Obj(sidecar, "nativeSceneRecord");
        E8Assets.Check(rec != null, "MISSING_NATIVE_SCENE_RECORD");
        var snap = Json.Obj(rec, "engineSnapshot");
        var st = Json.Obj(rec, "studioState");
        var approval = Json.Obj(st, "approval");
        E8Assets.Check(snap != null && st != null && approval != null, "INVALID_SIDECAR_STRUCTURE");
        E8Assets.Check(Json.Int(snap, "schemaVersion") == 1, "UNSUPPORTED_SCHEMA_VERSION");

        string sourceRevision = Json.Str(snap, "sourceRevision");
        string protectedSha = Json.Str(rec, "protectedSha256");
        int studioRevision = Json.Int(st, "revision");
        string approvalStatus = Json.Str(approval, "status");
        string approvalNote = approval.TryGetValue("note", out object noteObj) && noteObj is string ns ? ns : "";
        if (requireApproved)
        {
            E8Assets.Check(approvalStatus == "APPROVED", "UNAPPROVED_OR_STALE_STUDIO_SCENE " + approvalStatus);
            E8Assets.Check(Json.Int(approval, "approvedRevision") == studioRevision, "APPROVAL_REVISION_MISMATCH");
            E8Assets.Check(Json.Str(approval, "approvedSourceRevision") == sourceRevision, "APPROVAL_SOURCE_MISMATCH");
        }

        string srcPrefix = sceneKey + "/" + light + "/";
        string sceneJsonPath = srcPrefix + "scene.json";
        E8Assets.Check(entries.TryGetValue(sceneJsonPath, out byte[] sceneBytes), "MISSING_SCENE_JSON " + sceneJsonPath);
        var sceneObj = Json.Parse(Encoding.UTF8.GetString(sceneBytes)) as Dictionary<string, object>;
        E8Assets.Check(sceneObj != null && Json.Int(sceneObj, "version") == 1, "UNSUPPORTED_SCHEMA_VERSION");
        E8Assets.Check(Json.Str(sceneObj, "id") == sceneKey && Json.Str(sceneObj, "light") == light, "SCENE_PROVENANCE_MISMATCH");

        string destSubdir = string.IsNullOrEmpty(targetSubdirOverride) ? (sceneKey + "/" + light) : targetSubdirOverride.Trim('/');
        string outDir = Path.Combine(resourcesRoot, destSubdir.Replace('/', Path.DirectorySeparatorChar));
        Directory.CreateDirectory(outDir);

        string RemapAsset(string stemRef, string label)
        {
            ValidateZipEntryPath(stemRef);
            string zipPng = stemRef + ".png";
            E8Assets.Check(entries.TryGetValue(zipPng, out byte[] pngBytes), "MISSING_ASSET " + zipPng);
            ValidatePngBounds(pngBytes, label);
            string fileName = Path.GetFileName(zipPng);
            File.WriteAllBytes(Path.Combine(outDir, fileName), pngBytes);
            return destSubdir + "/" + Path.GetFileNameWithoutExtension(fileName);
        }

        sceneObj["atlas"] = RemapAsset(Json.Str(sceneObj, "atlas"), "atlas");
        sceneObj["foreground"] = RemapAsset(Json.Str(sceneObj, "foreground"), "foreground");
        if (sceneObj.TryGetValue("correction", out object corrObj) && corrObj is string corrStr && !string.IsNullOrEmpty(corrStr))
            sceneObj["correction"] = RemapAsset(corrStr, "correction");

        var layersList = Json.Arr(sceneObj, "layers");
        E8Assets.Check(layersList != null && layersList.Count > 0, "INVALID_LAYER_METADATA");
        foreach (object item in layersList)
        {
            var layerObj = item as Dictionary<string, object>;
            E8Assets.Check(layerObj != null, "INVALID_LAYER_METADATA");
            layerObj["texture"] = RemapAsset(Json.Str(layerObj, "texture"), Json.Str(layerObj, "id"));
        }

        // Merge approved interaction overrides & Studio provenance into scene.json cleanly
        var intOverrides = Json.Obj(st, "interactionOverrides");
        var snapInts = Json.Arr(snap, "interactions");
        var mergedInts = new List<Dictionary<string, object>>();
        var lmObj = Json.Obj(sceneObj, "landmark");
        string primaryId = "primary-landmark";
        string primaryLabel = "";
        string primaryLinked = "";
        if (snapInts != null)
        {
            foreach (object rawInt in snapInts)
            {
                var si = rawInt as Dictionary<string, object>;
                if (si == null) continue;
                string iid = Json.Str(si, "id");
                string kind = Json.Str(si, "kind");
                string iRev = si.TryGetValue("sourceRevision", out object ro) && ro is string rs ? rs : sourceRevision;
                object atObj = si["at"];
                object standObj = si["stand"];
                string label = si.TryGetValue("label", out object lo) && lo is string ls ? ls : "";
                string linked = si.TryGetValue("linkedEntityId", out object eo) && eo is string es ? es : "";
                if (intOverrides != null && intOverrides.TryGetValue(iid, out object ovRaw) && ovRaw is Dictionary<string, object> ov)
                {
                    if (ov.TryGetValue("label", out object ovL) && ovL is string ovLs) label = ovLs;
                    if (ov.TryGetValue("linkedEntityId", out object ovE) && ovE is string ovEs) linked = ovEs;
                    if (ov.TryGetValue("stand", out object ovS) && ovS is Dictionary<string, object>) standObj = ovS;
                }
                mergedInts.Add(new Dictionary<string, object>
                {
                    ["id"] = iid,
                    ["kind"] = kind,
                    ["label"] = label,
                    ["linkedEntityId"] = linked,
                    ["sourceRevision"] = iRev,
                    ["at"] = atObj,
                    ["stand"] = standObj,
                });
                if (mergedInts.Count == 1)
                {
                    primaryId = iid; primaryLabel = label; primaryLinked = linked;
                    if (lmObj != null)
                    {
                        lmObj["id"] = iid;
                        lmObj["label"] = label;
                        lmObj["linkedEntityId"] = linked;
                        lmObj["sourceRevision"] = iRev;
                        lmObj["stand"] = standObj;
                    }
                }
            }
        }

        sceneObj["studio"] = new Dictionary<string, object>
        {
            ["schemaVersion"] = 1,
            ["studioRevision"] = studioRevision,
            ["approvalStatus"] = approvalStatus,
            ["approvalNote"] = approvalNote,
            ["protectedSha256"] = protectedSha,
            ["zipSha256"] = zipSha,
            ["zipName"] = zipName,
            ["interactions"] = mergedInts,
        };

        File.WriteAllText(Path.Combine(outDir, "scene.json"), Json.Stringify(sceneObj), Encoding.UTF8);
        File.WriteAllBytes(Path.Combine(outDir, "studio-scene-sidecar.json"), sidecarBytes);
        File.WriteAllBytes(Path.Combine(outDir, "export-manifest.json"), manifestBytes);

        var spawnObj = Json.Obj(sceneObj, "spawn");
        var standPt = Json.Obj(lmObj, "stand");
        return new ImportedStudioScene
        {
            SceneId = Json.Str(rec, "id"),
            SceneKey = sceneKey,
            Light = light,
            ResourceSubdir = destSubdir,
            ZipName = zipName,
            ZipSha256 = zipSha,
            SourceRevision = sourceRevision,
            ProtectedSha256 = protectedSha,
            StudioRevision = studioRevision,
            ApprovalStatus = approvalStatus,
            ApprovalNote = approvalNote,
            InteractionId = primaryId,
            InteractionLabel = primaryLabel,
            LinkedEntityId = primaryLinked,
            SpawnX = Json.Int(spawnObj, "x"),
            SpawnY = Json.Int(spawnObj, "y"),
            StandX = Json.Int(standPt, "x"),
            StandY = Json.Int(standPt, "y"),
            SceneJsonResourcePath = destSubdir + "/scene",
        };
    }

    public static List<ImportedStudioScene> ImportManifest(string manifestPath, string resourcesRoot)
    {
        E8Assets.Check(File.Exists(manifestPath), "STUDIO_MANIFEST_MISSING " + manifestPath);
        var doc = Json.Parse(File.ReadAllText(manifestPath)) as Dictionary<string, object>;
        var items = Json.Arr(doc, "items");
        E8Assets.Check(items != null && items.Count > 0, "EMPTY_STUDIO_MANIFEST");
        var imported = new List<ImportedStudioScene>(items.Count);
        foreach (object raw in items)
        {
            var item = raw as Dictionary<string, object>;
            E8Assets.Check(item != null, "INVALID_MANIFEST_ITEM");
            string zipPath = Json.Str(item, "zipPath");
            string targetSubdir = item.TryGetValue("targetSubdir", out object ts) && ts is string tsStr ? tsStr : null;
            imported.Add(ImportZipToDirectory(zipPath, resourcesRoot, targetSubdir, true));
        }
        return imported;
    }

    static class Json
    {
        public static Dictionary<string, object> Obj(Dictionary<string, object> d, string k) =>
            d != null && d.TryGetValue(k, out object v) ? v as Dictionary<string, object> : null;
        public static List<object> Arr(Dictionary<string, object> d, string k) =>
            d != null && d.TryGetValue(k, out object v) ? v as List<object> : null;
        public static string Str(Dictionary<string, object> d, string k)
        {
            E8Assets.Check(d != null && d.TryGetValue(k, out object v) && v is string, "JSON_STR " + k);
            return (string)d[k];
        }
        public static int Int(Dictionary<string, object> d, string k)
        {
            E8Assets.Check(d != null && d.TryGetValue(k, out object v) && (v is long || v is int), "JSON_INT " + k);
            return Convert.ToInt32(d[k], CultureInfo.InvariantCulture);
        }

        public static object Parse(string text)
        {
            int i = 0;
            object val = ParseValue(text, ref i);
            SkipWs(text, ref i);
            E8Assets.Check(i == text.Length, "JSON_TRAILING");
            return val;
        }
        static void SkipWs(string s, ref int i) { while (i < s.Length && char.IsWhiteSpace(s[i])) i++; }
        static object ParseValue(string s, ref int i)
        {
            SkipWs(s, ref i);
            E8Assets.Check(i < s.Length, "JSON_EOF");
            char c = s[i];
            if (c == '{') return ParseObj(s, ref i);
            if (c == '[') return ParseArr(s, ref i);
            if (c == '"') return ParseStr(s, ref i);
            if (c == 't') { E8Assets.Check(s.Substring(i, 4) == "true", "JSON_BOOL"); i += 4; return true; }
            if (c == 'f') { E8Assets.Check(s.Substring(i, 5) == "false", "JSON_BOOL"); i += 5; return false; }
            if (c == 'n') { E8Assets.Check(s.Substring(i, 4) == "null", "JSON_NULL"); i += 4; return null; }
            return ParseNum(s, ref i);
        }
        static Dictionary<string, object> ParseObj(string s, ref int i)
        {
            i++;
            var d = new Dictionary<string, object>(StringComparer.Ordinal);
            SkipWs(s, ref i);
            if (i < s.Length && s[i] == '}') { i++; return d; }
            while (true)
            {
                SkipWs(s, ref i);
                string key = ParseStr(s, ref i);
                SkipWs(s, ref i);
                E8Assets.Check(i < s.Length && s[i] == ':', "JSON_COLON");
                i++;
                d[key] = ParseValue(s, ref i);
                SkipWs(s, ref i);
                if (i < s.Length && s[i] == '}') { i++; return d; }
                E8Assets.Check(i < s.Length && s[i] == ',', "JSON_COMMA");
                i++;
            }
        }
        static List<object> ParseArr(string s, ref int i)
        {
            i++;
            var a = new List<object>();
            SkipWs(s, ref i);
            if (i < s.Length && s[i] == ']') { i++; return a; }
            while (true)
            {
                a.Add(ParseValue(s, ref i));
                SkipWs(s, ref i);
                if (i < s.Length && s[i] == ']') { i++; return a; }
                E8Assets.Check(i < s.Length && s[i] == ',', "JSON_COMMA");
                i++;
            }
        }
        static string ParseStr(string s, ref int i)
        {
            E8Assets.Check(s[i] == '"', "JSON_QUOTE");
            i++;
            var sb = new StringBuilder();
            while (i < s.Length)
            {
                char c = s[i++];
                if (c == '"') return sb.ToString();
                if (c == '\\')
                {
                    E8Assets.Check(i < s.Length, "JSON_ESC");
                    char e = s[i++];
                    if (e == '"' || e == '\\' || e == '/') sb.Append(e);
                    else if (e == 'b') sb.Append('\b');
                    else if (e == 'f') sb.Append('\f');
                    else if (e == 'n') sb.Append('\n');
                    else if (e == 'r') sb.Append('\r');
                    else if (e == 't') sb.Append('\t');
                    else if (e == 'u') { sb.Append((char)Convert.ToInt32(s.Substring(i, 4), 16)); i += 4; }
                    else throw new InvalidDataException("E8: JSON_ESC");
                }
                else sb.Append(c);
            }
            throw new InvalidDataException("E8: JSON_UNTERMINATED_STR");
        }
        static object ParseNum(string s, ref int i)
        {
            int start = i;
            if (s[i] == '-') i++;
            while (i < s.Length && char.IsDigit(s[i])) i++;
            bool dbl = false;
            if (i < s.Length && s[i] == '.') { dbl = true; i++; while (i < s.Length && char.IsDigit(s[i])) i++; }
            if (i < s.Length && (s[i] == 'e' || s[i] == 'E')) { dbl = true; i++; if (i < s.Length && (s[i] == '+' || s[i] == '-')) i++; while (i < s.Length && char.IsDigit(s[i])) i++; }
            string tok = s.Substring(start, i - start);
            return dbl ? (object)double.Parse(tok, CultureInfo.InvariantCulture) : long.Parse(tok, CultureInfo.InvariantCulture);
        }
        public static string Stringify(object val)
        {
            if (val == null) return "null";
            if (val is bool b) return b ? "true" : "false";
            if (val is int || val is long || val is double) return Convert.ToString(val, CultureInfo.InvariantCulture);
            if (val is string str)
            {
                var sb = new StringBuilder(str.Length + 4);
                sb.Append('"');
                foreach (char c in str)
                {
                    if (c == '"') sb.Append("\\\"");
                    else if (c == '\\') sb.Append("\\\\");
                    else if (c == '\n') sb.Append("\\n");
                    else if (c == '\r') sb.Append("\\r");
                    else if (c == '\t') sb.Append("\\t");
                    else if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                    else sb.Append(c);
                }
                return sb.Append('"').ToString();
            }
            if (val is List<object> list)
            {
                var parts = new string[list.Count];
                for (int idx = 0; idx < list.Count; idx++) parts[idx] = Stringify(list[idx]);
                return "[" + string.Join(",", parts) + "]";
            }
            if (val is List<Dictionary<string, object>> dlist)
            {
                var parts = new string[dlist.Count];
                for (int idx = 0; idx < dlist.Count; idx++) parts[idx] = Stringify(dlist[idx]);
                return "[" + string.Join(",", parts) + "]";
            }
            if (val is Dictionary<string, object> dict)
            {
                var parts = new List<string>(dict.Count);
                foreach (var kv in dict) parts.Add(Stringify(kv.Key) + ":" + Stringify(kv.Value));
                return "{" + string.Join(",", parts) + "}";
            }
            throw new InvalidDataException("E8: JSON_STRINGIFY_UNSUPPORTED " + val.GetType().Name);
        }
    }
}
