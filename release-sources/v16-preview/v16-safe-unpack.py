"""Verify the pinned CI ZIP and safely unpack once into a new directory.

This does not download, deploy, or accept alternate digests; a caller must also
verify the GitHub run/job/artifact metadata before invoking it.
"""
import hashlib
import os
import stat
import sys
import zipfile
from pathlib import Path, PurePosixPath

SIZE = 110960840
DIGEST = '27507c3337842a00c3913147b4fd3dd5b5463bf07d57bb75107a1da27c0220de'


def validate_infos(infos):
    if len(infos) > 1000:
        raise ValueError('ZIP_ENTRY_LIMIT')
    names = set()
    total = 0
    files = 0
    for item in infos:
        name = item.filename
        parts = PurePosixPath(name).parts
        if (not name or '\\' in name or ':' in name or name.startswith('/')
                or any(p in ('', '.', '..') for p in name.rstrip('/').split('/'))
                or not parts or parts[0] not in ('admin', 'coach')):
            raise ValueError('ZIP_PATH_DENIED')
        key = name.rstrip('/').casefold()
        if key in names:
            raise ValueError('ZIP_DUPLICATE')
        names.add(key)
        mode = item.external_attr >> 16
        if stat.S_ISLNK(mode) or (mode and stat.S_IFMT(mode) not in (0, stat.S_IFREG, stat.S_IFDIR)):
            raise ValueError('ZIP_SPECIAL_FILE')
        if item.flag_bits & 1:
            raise ValueError('ZIP_ENCRYPTED')
        if not item.is_dir():
            files += 1
            total += item.file_size
            if item.file_size > 128 * 1024 * 1024 or total > 256 * 1024 * 1024:
                raise ValueError('ZIP_SIZE_LIMIT')
            if item.file_size and (not item.compress_size or item.file_size > item.compress_size * 500):
                raise ValueError('ZIP_RATIO_LIMIT')
    if files != 437:
        raise ValueError('ZIP_FILE_COUNT')


def run(source, dest):
    source, dest = Path(source), Path(dest)
    if not source.is_file() or source.is_symlink() or dest.exists():
        raise ValueError('INPUT_OR_DESTINATION_DENIED')
    digest = hashlib.sha256()
    length = 0
    with source.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            length += len(block)
            if length > SIZE:
                raise ValueError('ZIP_LENGTH')
            digest.update(block)
    if length != SIZE or digest.hexdigest() != DIGEST:
        raise ValueError('ZIP_INTEGRITY')
    with zipfile.ZipFile(source) as archive:
        infos = archive.infolist()
        validate_infos(infos)
        dest.mkdir(parents=False, exist_ok=False)
        for item in infos:
            target = dest.joinpath(*PurePosixPath(item.filename).parts)
            if item.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(item) as src, target.open('xb') as out:
                while True:
                    data = src.read(1024 * 1024)
                    if not data:
                        break
                    out.write(data)
    print('PINNED_ARTIFACT_UNPACKED; full tree and seal verification still required')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('usage: v16-safe-unpack.py ZIP NEW_DIRECTORY')
    run(sys.argv[1], sys.argv[2])
