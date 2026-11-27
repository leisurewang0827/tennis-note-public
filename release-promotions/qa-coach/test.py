"""Exercise the packaged router and normal Auth handler with fictitious responses; no live sign-in."""
import os, subprocess, sys, tempfile
from build import *
actor=["00000000-0000-4000-8000-%012d"%i for i in (1,2,3,4)]
tags={k:sha(("tn-dev-coach:v1:"+k+":"+v).encode()) for k,v in {"mail":"one@test.invalid","scope":":".join(actor)}.items()}
if __name__=="__main__":
    raw=Path(sys.argv[1]).read_bytes(); m,files=baseline(); code=make_client(raw,tags)
    with tempfile.TemporaryDirectory() as tmp:
        worker=Path(tmp)/"worker.mjs"
        worker.write_bytes(router(m["control"]["_worker.js"].encode(),code))
        subprocess.run(["node","--check",str(worker)],check=True)
        subprocess.run(["node",str(HERE/"test.mjs"),str(worker),*sys.argv[2:]],check=True)
