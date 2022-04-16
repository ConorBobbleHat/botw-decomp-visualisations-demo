import json
import csv
import re
from tqdm import tqdm

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
        "size": row["Size"],
        "name": demangle_function_name(row["Name"])
    }

with open("botw/data/uking_functions.csv", newline="") as f:
    functions = list(map(parse_row, csv.DictReader(f)))

NODES = []
EDGES = []

edge_index = 0

created_namespace_nodes = {}

def determine_class_status(class_):
    class_functions = []
    for function in functions:
        function_name_parts = function['name'].split("::")
        function_class_name = function_name_parts[-2] if len(function_name_parts) >= 2 else function_name_parts[-1]

        class_name = class_.split("::")[-1]
        
        if function_class_name == class_name:
            class_functions.append(function)

    class_function_qualities = set([i['quality'] for i in class_functions])

    if len(class_function_qualities) == 0 or class_function_qualities == {"U"}:
        return "undecompiled_class"
    elif class_function_qualities == {"O"}:
        return "decompiled_class"
    
    return "partially_decompiled_class"

def create_namespace_node(namespace):
    global edge_index, created_namespace_nodes

    parts = namespace.split("::")

    for i in range(1, len(parts) + 1):
        current_namespace = "::".join(parts[:i])

        if current_namespace in created_namespace_nodes:
            continue

        NODES.append({"id": edge_index, "name": current_namespace, "type": "namespace"})
        created_namespace_nodes[current_namespace] = edge_index

        if i != 1:
            EDGES.append({"source": edge_index, "target": created_namespace_nodes["::".join(parts[:i-1])]})
        
        edge_index += 1


for class_ in tqdm(d.keys()):
    namespace = "::".join(class_.split("::")[:-1])

    if namespace not in created_namespace_nodes:
        create_namespace_node(namespace)

    NODES.append({"id": edge_index, "name": class_, "type": determine_class_status(class_)})
    EDGES.append({"source": edge_index, "target": created_namespace_nodes[namespace]})
    edge_index += 1


with open("site/graph.json", "w") as f:
    json.dump({"nodes": NODES, "edges": EDGES}, f)