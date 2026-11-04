#!/usr/bin/env python3
"""Render deployment files offline; bootstrap must finish before foundation review."""
import argparse
from pathlib import Path
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--bootstrap', action='store_true', help='Render the separate encrypted-parameter bootstrap stack')
args = parser.parse_args()
root = Path(__file__).resolve().parent
source = (root / ('bootstrap.yaml' if args.bootstrap else 'foundation.yaml')).read_text()
marker = '        ZipFile: __PARAMETER_CODE__\n'
if args.bootstrap:
    if source.count(marker) != 1:
        raise SystemExit('Expected exactly one inline parameter handler marker')
    code = (root / 'secure-parameters.cjs').read_text()
    source = source.replace(marker, '        ZipFile: |\n' + ''.join('          ' + line + '\n' for line in code.splitlines()))
elif '__PARAMETER_CODE__' in source:
    raise SystemExit('The foundation must not generate its own prerequisite parameters')
sys.stdout.write(source)
