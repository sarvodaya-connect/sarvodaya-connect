#!/usr/bin/env python3
"""Render the reviewed inline handler; no AWS calls, configuration or secrets."""
from pathlib import Path
import sys

root = Path(__file__).resolve().parent
source = (root / 'foundation.yaml').read_text()
marker = '        ZipFile: __PARAMETER_CODE__\n'
if source.count(marker) != 1:
    raise SystemExit('Expected exactly one inline parameter handler marker')
code = (root / 'secure-parameters.cjs').read_text()
rendered = source.replace(marker, '        ZipFile: |\n' + ''.join('          ' + line + '\n' for line in code.splitlines()))
sys.stdout.write(rendered)
