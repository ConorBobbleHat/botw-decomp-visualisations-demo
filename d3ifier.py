import yaml

import json
import csv
import re

with open("out.json") as f:
    d = json.load(f)

def demangle_function_name(function_name):
    if not function_name.startswith("_Z"):
        return function_name

    try:
        first_digit_index = [i for (i, c) in enumerate(function_name) if c.isdigit()][0]
        
        function_name_working = function_name[first_digit_index:]
        function_fqn_pieces = []

        try:
            while True:
                if function_name_working.startswith("C"):
                    # Constructor - special case.
                    function_fqn_pieces.append(function_fqn_pieces[-1])
                
                if function_name_working.startswith("D"):
                    # Destructor - special case.
                    function_fqn_pieces.append("~" + function_fqn_pieces[-1])

                fqn_length = re.match(r"(^\d+)", function_name_working).group(0)
                fqn_length_len = len(fqn_length)
                fqn_length = int(fqn_length)

                function_fqn_pieces.append(function_name_working[fqn_length_len : fqn_length + fqn_length_len])
                function_name_working = function_name_working[fqn_length + fqn_length_len:]
        except:
            return "::".join(function_fqn_pieces)

    except:
        return function_name
    

def parse_row(row):
    return {
        "address": int(row["Address"], base=16),
        "quality": row["Quality"],
        "size": int(row["Size"]),
        "name": demangle_function_name(row["Name"])
    }

with open("botw/data/uking_functions.csv", newline="") as f:
    functions = list(map(parse_row, csv.DictReader(f)))

CLASS_FQN_NAMES = d
CLASS_NAMES = [i.split("::")[-1] for i in CLASS_FQN_NAMES]
CLASS_NAME_TO_FQN_MAP = {i.split("::")[-1] : i for i in CLASS_FQN_NAMES}

CLASS_FUNCTIONS = {}

for function in functions:
    function_name_parts = function['name'].split("::")
    function_class_name = function_name_parts[-2] if len(function_name_parts) >= 2 else function_name_parts[-1]
       
    if function_class_name in CLASS_NAMES:
        fqn = CLASS_NAME_TO_FQN_MAP[function_class_name]
        if fqn not in CLASS_FUNCTIONS:
            CLASS_FUNCTIONS[fqn] = []

        CLASS_FUNCTIONS[fqn].append(function)

CLASS_STATUS_OVERRIDE_FILES = [
    ("botw/data/status_action.yml", "uking::"),
    ("botw/data/status_ai.yml", "uking::"),
    ("botw/data/status_query.yml", "uking::")
]

CLASS_STATUS_OVERRIDES = {}

for (file, namespace_prefix) in CLASS_STATUS_OVERRIDE_FILES:
    with open(file) as f:
        for (class_, status) in yaml.safe_load(f).items():
            fqn = namespace_prefix + class_

            status = status['status']
            CLASS_STATUS_OVERRIDES[fqn] = "partially_decompiled_class" if status == "pending" else "decompiled_class"

def determine_class_status(class_):
    num_methods = 0
    total_binary_size = 0
    
    try:
        class_functions = CLASS_FUNCTIONS[class_]
        num_methods = len(class_functions)
        total_binary_size = sum([i["size"] for i in class_functions])
    except Exception as e:
        # No functions found whatsoever
        if class_ not in CLASS_STATUS_OVERRIDES:
            return "undecompiled_class", num_methods, total_binary_size
    
    if class_ in CLASS_STATUS_OVERRIDES:
        return CLASS_STATUS_OVERRIDES[class_], num_methods, total_binary_size

    class_function_qualities = set([i['quality'] for i in class_functions])

    if len(class_function_qualities) == 0 or class_function_qualities == {"U"}:
        return "undecompiled_class",  num_methods, total_binary_size
    elif class_function_qualities == {"O"}:
        return "decompiled_class", num_methods, total_binary_size
    
    return "partially_decompiled_class", num_methods, total_binary_size

TREE = {"id": 0, "name": "root", "type": "namespace", "children": []}
node_id_counter = 1

for class_ in CLASS_FQN_NAMES:
    class_fqn_pieces = class_.split("::")
    class_name = class_fqn_pieces[-1]

    current_tree = TREE['children']
    current_fqn = ""
    for piece in class_fqn_pieces:
        current_fqn += piece
        
        parent_index = next(iter(index for (index, d) in enumerate(current_tree) if d['name'] == current_fqn), -1)

        if parent_index == -1:
            new_child = {"id": node_id_counter, "name": current_fqn, "type": "namespace", "children": []}
            node_id_counter += 1

            if class_name == piece:
                # We've hit the end of this FQN.
                # Add on some metadata about this class
                class_status, num_methods, total_binary_size = determine_class_status(class_)
                new_child["type"] = class_status
                new_child["num_methods"] = num_methods
                new_child["total_binary_size"] = total_binary_size

            current_tree.append(new_child)
            current_tree = current_tree[-1]['children']
        else:
            current_tree = current_tree[parent_index]['children']

        current_fqn += "::"

with open("docs/graph.json", "w") as f:
    json.dump(TREE, f)