import sys

path = "/etc/systemd/system/drivelegal-backend.service"
with open(path, "r") as f:
    lines = f.read().split("\n")

out_lines = []
for l in lines:
    out_lines.append(l)
    if l.startswith("Environment="):
        out_lines.append("EnvironmentFile=/home/ubuntu/drivelegal/.env")

with open(path, "w") as f:
    f.write("\n".join(out_lines))
