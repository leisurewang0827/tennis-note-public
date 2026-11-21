"""Safely unpack the exact prior V16 GitHub artifact; never download it here."""
import hashlib
import stat
import sys
import zipfile
from pathlib import Path, PurePosixPath

EXPECTED_SIZE = 110962092
EXPECTED_SHA = '86b9b3a755b72db936728842e24080beaab0d272f612ee2fc0b0c7f002f3a82c'

def extract(source, destination, size=EXPECTED_SIZE, digest=EXPECTED_SHA, expected_files=437):
    source, destination = Path(source), Path(destination)
    if not source.is_file() or source.is_symlink() or destination.exists():
        raise ValueError('INPUT_OR_DESTINATION_DENIED')
    h = hashlib.sha256()
    count = 0
    with source.open('rb') as stream:
        for block in iter(lambda: stream.read(1024*1024), b''):
            count += len(block)
            if count > size:
                raise ValueError('ZIP_LENGTH')
            h.update(block)
    if count != size or h.hexdigest() != digest:
        raise ValueError('ZIP_INTEGRITY')
    with zipfile.ZipFile(source) as archive:
        infos = archive.infolist()
        if len(infos) > 1000:
            raise ValueError('ZIP_ENTRY_LIMIT')
        seen, total, files = set(), 0, 0
        for item in infos:
            name = item.filename
            parts = PurePosixPath(name).parts
            if (not name or '\\' in name or ':' in name or name.startswith('/') or
                any(p in ('', '.', '..') for p in name.rstrip('/').split('/')) or
                not parts or parts[0] not in ('admin', 'coach')):
                raise ValueError('ZIP_PATH_DENIED')
            key = name.rstrip('/').casefold()
            if key in seen:
                raise ValueError('ZIP_DUPLICATE')
            seen.add(key)
            mode = item.external_attr >> 16
            if stat.S_ISLNK(mode) or (mode and stat.S_IFMT(mode) not in (0, stat.S_IFREG, stat.S_IFDIR)):
                raise ValueError('ZIP_SPECIAL_FILE')
            if item.flag_bits & 1:
                raise ValueError('ZIP_ENCRYPTED')
            if not item.is_dir():
                files += 1
                total += item.file_size
                if item.file_size > 128*1024*1024 or total > 256*1024*1024:
                    raise ValueError('ZIP_SIZE_LIMIT')
                if item.file_size and (not item.compress_size or item.file_size > item.compress_size*500):
                    raise ValueError('ZIP_RATIO_LIMIT')
        if files != expected_files:
            raise ValueError('ZIP_FILE_COUNT')
        destination.mkdir(parents=False, exist_ok=False)
        for item in infos:
            target = destination.joinpath(*PurePosixPath(item.filename).parts)
            if item.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(item) as src, target.open('xb') as out:
                while True:
                    data = src.read(1024*1024)
                    if not data:
                        break
                    out.write(data)

if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('SOURCE_AND_DESTINATION_REQUIRED')
    extract(sys.argv[1], sys.argv[2])
    print('PRIOR_ARCHIVE_PINNED; asset verification still required')
