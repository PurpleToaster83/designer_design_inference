import json
import csv

file = "./designer_data/08_29_25.json"
flask_letters = ['A', 'B', 'C', 'D']
person_id = []
participants = 5

ground_truth = {
    "1_1": ["A is a Poison"],
    "1_2": ["A is a Potion"],
    "1_3": ["A is a Poison"],
    "1_4": ["A is a Potion"],
    "2_1": ["A is a Potion", "B is a Poison"],
    "2_2": ["A is a Poison", "B is a Poison"],
    "2_3": ["A is a Potion", "B is a Poison"],
    "2_4": ["A is a Potion", "B is a Potion"],
    "3_1": ["A is a Poison", "B is a Poison"],
    "3_2": ["A is a Poison", "B is a Poison"],
    "3_3": ["A is a Potion", "B is a Potion", "C is a Potion"],
    "3_4": ["A is a Potion", "B is a Poison", "C is a Potion"]
}

available_slots = {
    "1_1": ['2-3', '0-6'],
    "1_2": ['2-3', '0-6'],
    "1_3": ['2-3'],
    "1_4": ['0-6'],
    "2_1": ['2-0', '0-1', '4-3', '4-6'],
    "2_2": ['2-0', '0-1', '4-3', '4-6'],
    "2_3": ['4-3', '4-6'],
    "2_4": ['0-1', '4-3', '4-6'],
    "3_1": ['5-2', '3-7'],
    "3_2": ['2-0', '5-2', '3-7'],
    "3_3": ['2-0', '5-2', '3-7'],
    "3_4": ['2-0', '4-0', '5-2', '3-7']
}

map_info = {}
for m in range(1, 4):
    for p in range(1, 5):
        map_info.update({f'{m}_{p}': {}})

with open(file, 'r') as file:
    raw_data = json.load(file)['results']

    for person in raw_data:
        for m, map in raw_data[person]['assignments'].items():
            if(m == 'tutorial1' or m == 'tutorial2'):
                break
            for s, slot in enumerate(available_slots[m]):
                if not map.get(slot):
                    flask_type = 0
                elif ground_truth[m][int(map.get(slot))][7:] == 'Potion':
                    flask_type = 1
                else:
                    flask_type = -1
                if not map_info[m].get(s):
                    map_info[m].update({s: [flask_type]})
                else:
                    map_info[m][s].extend([flask_type])

#TODO: compute average of flasks
print('blah')

with open('08_29_25_data.csv', 'w', newline='') as csvfile:
    fieldnames = ["Map", "Slot"]
    for p in range(participants):
        fieldnames.append(f'Person{p}')
    fieldnames.append("Average")
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
    writer.writeheader()
    
    for name, map in map_info.items():
        for id, slot in map.items():
            cur_info = {
                'Map': name,
                'Slot': id,
                'Average': sum(slot) / len(slot)
            }
            for p in range(participants):
                cur_info.update({f'Person{p}': slot[p]})
            writer.writerow(cur_info)