"""Create an explicit, deterministic runtime-source archive. Never builds/uploads."""
from pathlib import Path
import argparse, datetime, gzip, hashlib, json, subprocess, tarfile

ROOT_FILES = ['Dockerfile', '.dockerignore', 'package.json', 'package-lock.json', 'index.mjs']
CONFIG_FILES = ['gcp-storage.json', 'gcp-vertex-ai.json', 'model-acceptance.json', 'approved-photos.json']

def digest(data):
    return hashlib.sha256(data).hexdigest()

def prepare_snapshot(root, output, head):
    root, output = Path(root).resolve(), Path(output).resolve()
    if output.exists() or Path(str(output) + '.tar.gz').exists():
        raise ValueError('Snapshot output/archive already exists; refusing overwrite.')
    selected = {name: root / name for name in ROOT_FILES}
    for directory in ['src', 'public', 'assets', 'sql']:
        for path in sorted((root / directory).rglob('*')):
            if path.is_symlink():
                raise ValueError('Release symlinks are not supported.')
            if path.is_file():
                selected[str(path.relative_to(root))] = path
    for name in CONFIG_FILES:
        selected['config/' + name] = root / 'config' / name
    selected['cloudbuild.yaml'] = root / 'ops/cloudbuild-private.yaml'
    payload = {}
    for name, path in sorted(selected.items()):
        if path.is_symlink() or not path.is_file():
            raise ValueError('Required regular release file missing: ' + name)
        base = path.name.lower()
        if base in ['.env', '.npmrc', 'env.sh'] or base.startswith('.env.') or path.suffix.lower() in ['.pem', '.key', '.p12', '.pfx'] or any(marker in base for marker in ['credentials', 'service-account', 'service_account']):
            raise ValueError('Credential-like file rejected from release input: ' + name)
        data = path.read_bytes()
        if path.suffix in ['.js', '.mjs', '.json', '.yaml'] and any(marker in data for marker in [b'-----BEGIN PRIVATE KEY-----', b'-----BEGIN RSA PRIVATE KEY-----']):
            raise ValueError('Private-key material rejected from release input.')
        payload[name] = data
    output.mkdir(parents=True, exist_ok=False)
    hashes = {name: digest(data) for name, data in payload.items()}
    manifest = json.dumps(hashes, sort_keys=True, separators=(',', ':')).encode()
    for name, data in {**payload, 'SOURCE_MANIFEST.json': manifest}.items():
        destination = output / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
    archive = Path(str(output) + '.tar.gz')
    with archive.open('xb') as raw:
        with gzip.GzipFile(filename='', fileobj=raw, mode='wb', mtime=0) as gz:
            with tarfile.open(fileobj=gz, mode='w') as tar:
                for path in sorted(output.rglob('*')):
                    if not path.is_file():
                        continue
                    info = tar.gettarinfo(str(path), arcname=str(path.relative_to(output)))
                    info.uid = info.gid = info.mtime = 0
                    info.uname = info.gname = ''
                    info.mode = 0o644
                    with path.open('rb') as file:
                        tar.addfile(info, file)
    return {'createdAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'head': head,
            'sourceManifestSha256': digest(manifest), 'archiveSha256': digest(archive.read_bytes()),
            'files': hashes, 'snapshotPath': str(output), 'archivePath': str(archive),
            'buildPerformed': False, 'uploaded': False,
            'scope': 'Explicit runtime sources and approved samples; excludes docs/tools/test/env/keys/.git. Uncommitted source is identified by the complete manifest, never HEAD alone.'}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--evidence', required=True)
    args = parser.parse_args()
    evidence = Path(args.evidence)
    if evidence.exists():
        raise ValueError('Evidence file already exists; refusing overwrite.')
    root = Path.cwd()
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
    result = prepare_snapshot(root, args.output_dir, head)
    result['gitStatusShort'] = subprocess.check_output(['git', 'status', '--short'], text=True).splitlines()
    result['dependencyLockSha256'] = result['files']['package-lock.json']
    evidence.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({key: result[key] for key in ['sourceManifestSha256', 'archiveSha256', 'buildPerformed', 'uploaded']}))

if __name__ == '__main__':
    main()
