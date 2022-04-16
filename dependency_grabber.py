import clang.cindex
from pathlib import Path
from tqdm import tqdm

index = clang.cindex.Index.create()

CLASS_DEPENDENCIES = {}

def is_type_in_decomp(type_string):
    top_level_namespace = type_string.split("::")[0]
    return top_level_namespace == "ksys" or top_level_namespace == "uking"

def find_class_dependencies(cursor, class_name, depth=1):
    for i in cursor:
        if i.kind == clang.cindex.CursorKind.TYPE_REF and is_type_in_decomp(i.type.spelling) and i.type.spelling != class_name:
            CLASS_DEPENDENCIES[class_name].add(i.type.spelling)

        try:
            find_class_dependencies(i.get_children(), class_name, depth=depth+1)
        except Exception as e:
            #print (e)
            pass

def find_classes(cursor):
    for i in cursor:
        if i.kind == clang.cindex.CursorKind.CLASS_DECL:
            # Got one!
            class_fqn = i.type.spelling
            if is_type_in_decomp(class_fqn):
                if class_fqn not in CLASS_DEPENDENCIES:
                    CLASS_DEPENDENCIES[class_fqn] = set()

                find_class_dependencies(i.get_children(), class_fqn)

        try:
            find_classes(i.get_children())
        except Exception as e:
            #print (e)
            pass


for source_file in tqdm(list(Path("botw/src").rglob("*.cpp"))):
    translation_unit = index.parse(source_file, args=['-std=c++17', '-Ibotw/src'])
    find_classes(translation_unit.cursor.get_children())

for key in CLASS_DEPENDENCIES:
    CLASS_DEPENDENCIES[key] = list([i for i in CLASS_DEPENDENCIES[key] if i in CLASS_DEPENDENCIES])

import json
with open("out.json", "w") as f:
    json.dump(CLASS_DEPENDENCIES, f)