"""Transition safety, without a session, finance data or any network."""
import unittest
from unittest.mock import patch,Mock
import artifact as a
import promote as m

NEW="12345678-1111-4222-8333-456789abcdef"
HEAD="d"*40
PATH=sorted(a.CHANGE)[0]
class Scope(unittest.TestCase):
    def run_alias(self,second,known=True,first=None,reader=None):
        first=first or "3"*64
        p=a.policy()
        before=a.DigestMismatch(PATH,first)
        with patch.object(m,"served",side_effect=[before,None]) as served,patch.object(m,"public_bytes",side_effect=second),patch.object(m,"canonical"),patch.object(m,"identity",return_value=NEW if known else "other"),patch.object(m.time,"sleep"),patch.object(m,"rollback_if_ours") as restore:
            try: m.alias_check(NEW,HEAD); outcome="pass"
            except (ValueError,OSError) as e: outcome=str(e)
            return outcome,restore.call_count,served.call_count
    def test_unknown_project(self):
        for host in ("tennisnote-app.pages.dev","tennisnote-admin-dev.pages.dev","x."+a.PAGES,a.PAGES+".example.org"):
            with self.assertRaises(ValueError): a.origin(host)
    def test_propagated(self):
        self.assertEqual(self.run_alias(None),("pass",0,2))
    def test_prior_bytes_are_not_a_rollback_reason(self):
        prev=a.policy()["files"][PATH]
        self.assertEqual(self.run_alias(a.DigestMismatch(PATH,prev),first=prev)[1],0)
    def test_other_owner(self):
        self.assertEqual(self.run_alias(None,False)[1:],(0,1))
    def test_confirmed_corruption(self):
        self.assertEqual(self.run_alias(a.DigestMismatch(PATH,"3"*64))[1],1)
    def test_unknown_reads(self):
        self.assertEqual(self.run_alias(OSError("timeout"))[1],0)
        self.assertEqual(self.run_alias(a.DigestMismatch(PATH,"4"*64))[1],0)
    def test_preview_failure_stops_canonical(self):
        with patch.object(m,"context",return_value=HEAD),patch.object(m,"publish",return_value=NEW) as pub,patch.object(m,"served",side_effect=ValueError("preview mismatch")):
            with self.assertRaises(ValueError): m.go()
            self.assertEqual([c.args for c in pub.call_args_list],[(m.PREVIEW,HEAD)])
    def test_canonical_changed_before_rollback(self):
        with patch.object(m,"identity",side_effect=[a.OLD,"new-owner"]),patch.object(m,"canonical"),patch.object(m,"cf") as cf:
            with self.assertRaises(ValueError): m.rollback_if_ours(NEW,HEAD)
            self.assertFalse(any("POST" in c.args for c in cf.call_args_list))
    def test_controls_and_delta(self):
        p=a.policy();self.assertEqual(len(set(p["files"])-a.CHANGE),251)
        for key in a.CONTROLS:self.assertEqual(a.sha(p["control"][key].encode()),p["files"][key])

if __name__=="__main__": unittest.main()
