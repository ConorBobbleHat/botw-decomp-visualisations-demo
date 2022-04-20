import clang.cindex
from pathlib import Path
from tqdm import tqdm

index = clang.cindex.Index.create()

CLASSES = set()

def is_type_in_decomp(type_string):
    top_level_namespace = type_string.split("::")[0]
    return top_level_namespace == "ksys" or top_level_namespace == "uking"

def find_classes(cursor):
    for i in cursor:
        if i.kind == clang.cindex.CursorKind.CLASS_DECL:
            # Got one!
            class_fqn = i.type.spelling
            if is_type_in_decomp(class_fqn):
                CLASSES.add(class_fqn)

        try:
            find_classes(i.get_children())
        except Exception as e:
            pass


for source_file in tqdm(list(Path("botw/src").rglob("*.cpp"))):
    translation_unit = index.parse(source_file, args=['-std=c++17', '-Ibotw/src'])
    find_classes(translation_unit.cursor.get_children())

import json
with open("classes.json", "w") as f:
    json.dump(list(CLASSES), f)