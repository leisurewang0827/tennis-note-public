import hashlib
import importlib.util
from pathlib import Path
import tempfile
import zipfile

candidate=Path(__file__).with_name('safe-unpack.py')
if not candidate.exists(): candidate=Path(__file__).with_name('v17-safe-unpack.py')
spec=importlib.util.spec_from_file_location('unpack',candidate)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
checks=0
with tempfile.TemporaryDirectory(prefix='tennisnote-v17-zip-test-') as tmp:
    root=Path(tmp)
    def make(name, entries):
        p=root/name
        with zipfile.ZipFile(p,'w') as z:
            for n in entries: z.writestr(n,b'synthetic')
        b=p.read_bytes()
        return p,len(b),hashlib.sha256(b).hexdigest()
    good,n,h=make('good.zip',['admin/site/a','coach/site/b'])
    module.extract(good,root/'good',n,h,2)
    assert (root/'good/admin/site/a').read_bytes()==b'synthetic'
    checks+=1
    for index,(filename,entries,expected) in enumerate([
        ('bad-path.zip',['admin/../../unsafe'],'ZIP_PATH_DENIED'),
        ('bad-case.zip',['admin/site/a','admin/site/A'],'ZIP_DUPLICATE'),
        ('bad-count.zip',['admin/site/a'],'ZIP_FILE_COUNT'),
    ]):
        f,size,digest=make(filename,entries)
        try: module.extract(f,root/('bad'+str(index)),size,digest,2)
        except ValueError as e: assert str(e)==expected
        else: raise AssertionError(expected)
        checks+=1
    try: module.extract(good,root/'bad-hash',n,'0'*64,2)
    except ValueError as e: assert str(e)=='ZIP_INTEGRITY'
    else: raise AssertionError('ZIP_INTEGRITY')
    checks+=1
print(f'PASS_SYNTHETIC_SAFE_UNPACK checks={checks}')
