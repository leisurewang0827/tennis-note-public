"""Reuse the verified ZIP path guard with the exact new prior artifact pin."""
import importlib.util
import sys
from pathlib import Path
location=Path(__file__).resolve().parents[1]/'v17-web'/'safe-unpack.py'
spec=importlib.util.spec_from_file_location('prior_safe_unpack',location)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
if len(sys.argv)!=3:
    raise SystemExit('SOURCE_AND_DESTINATION_REQUIRED')
module.extract(sys.argv[1],sys.argv[2],110964002,'3d85688b72790dd594926262c8fec0e5563e25f58e3dea92520592aa67011b65',437)
print('EXACT_PRIOR_V17_ARCHIVE_PASS')
