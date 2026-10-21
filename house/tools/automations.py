#!/usr/bin/env python3
"""Writes house/automations-data.js: Home Assistant's automations and scripts,
as ha-config keeps them (automations.yaml, scripts.yaml), for the Automations
view (automations.js).

Home Assistant only hands an automation's config to an admin's token
(automation/config is require_admin), so the view reads what each one does from
this copy, and from Home Assistant itself only when the token allows. Re-run it
after the automations change in ha-config:

    python3 house/tools/automations.py ../ha-config

Only what the view reads is kept: the name, the description, the variables, the
triggers, the conditions, the actions and the mode. Comments are gone; templates stay, as the
devices they name are read out of them.
"""
import json
import pathlib
import re
import sys

import yaml


class Loader(yaml.SafeLoader):
    pass


# Home Assistant's own tags (!secret, !include, !input...): kept as a plain string.
Loader.add_multi_constructor('!', lambda loader, suffix, node: f'!{suffix} {getattr(node, "value", "")}')

KEEP = ('alias', 'description', 'variables', 'triggers', 'trigger', 'conditions', 'condition', 'actions', 'action', 'mode')


def load(path):
    with open(path, encoding='utf-8') as f:
        return yaml.load(f, Loader=Loader) or {}


def plain(v):
    """Times and dates YAML parsed (an `at: 08:30:00` is a sexagesimal int in YAML 1.1) back to plain JSON."""
    if isinstance(v, dict):
        return {str(k): plain(x) for k, x in v.items()}
    if isinstance(v, list):
        return [plain(x) for x in v]
    if isinstance(v, (str, int, float, bool)) or v is None:
        return v
    return str(v)


def main():
    ha = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '../ha-config')
    autos = {}
    for a in load(ha / 'automations.yaml'):
        if not isinstance(a, dict) or 'id' not in a:
            continue
        autos[str(a['id'])] = plain({k: a[k] for k in KEEP if k in a})
    scripts = {}
    for sid, s in load(ha / 'scripts.yaml').items():
        if isinstance(s, dict):
            scripts[sid] = plain({k: s[k] for k in ('alias', 'description', 'variables', 'sequence', 'mode') if k in s})
    # Only the scripts the automations start (and those they start in turn): the view reads them for their devices.
    used, todo = set(), [json.dumps(autos)]
    while todo:
        for sid in re.findall(r'\bscript\.([a-z0-9_]+)', todo.pop()):
            if sid in scripts and sid not in used:
                used.add(sid)
                todo.append(json.dumps(scripts[sid]))
    scripts = {k: v for k, v in scripts.items() if k in used}
    out = pathlib.Path(__file__).resolve().parent.parent / 'automations-data.js'
    out.write_text(
        '// Home Assistant\'s automations and scripts, as ha-config keeps them, for the Automations view.\n'
        '// Written by tools/automations.py (re-run it after the automations change); do not edit by hand.\n'
        "'use strict';\n"
        f'const HA_AUTOS = {json.dumps(autos, ensure_ascii=False, separators=(",", ":"))};\n'
        f'const HA_SCRIPTS = {json.dumps(scripts, ensure_ascii=False, separators=(",", ":"))};\n',
        encoding='utf-8')
    print(f'{out}: {len(autos)} automations, {len(scripts)} scripts, {out.stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
