# India Education Institutions & Cities Dataset

A clean, deduplicated dataset of **Indian colleges, schools, and cities** designed for building education apps, search platforms, and data science projects.

The dataset provides structured information about major educational institutions across India along with a comprehensive list of cities covering all states and Union Territories.

This dataset was originally built to support education-focused applications such as campus marketplaces and student platforms, but it can also be used for research, analytics, and machine learning projects.

---

# Dataset Overview

The dataset contains **three CSV files**.

## `india_colleges.csv` — 1,203 institutions

A curated list of major Indian colleges and universities with location, institution type, and where available: fees, placement data, and rankings.

### Coverage

Includes:

* All **23 IITs**
* All **31 NITs**
* **20 IIITs**
* All **21 IIMs**
* **BITS Pilani / Goa / Hyderabad**
* All **AIIMS campuses**
* **National Law Universities (NLUs)**
* **Central Universities**
* **State Universities**
* **480+ Engineering Colleges**
* Major **private universities** such as VIT, Manipal, Amity, LPU, KIIT, Chandigarh University

### Columns

| Column              | Description                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `name`              | Institution name                                                                                                    |
| `city`              | City where the institution is located                                                                               |
| `state`             | State or Union Territory                                                                                            |
| `type`              | Institution category (IIT, NIT, IIIT, IIM, BITS, AIIMS, Engineering, Private, Government, University, NLU, Medical) |
| `fees_ug_inr`       | Annual undergraduate tuition fees in INR (where available)                                                          |
| `placement_avg_lpa` | Average placement package in LPA (where available)                                                                  |
| `rating`            | Institutional rating or score                                                                                       |
| `nirf_rank`         | NIRF 2024 ranking (where available)                                                                                 |

---

## `india_schools.csv` — 247 schools

A dataset of well-known Indian schools across multiple states and cities.

Includes schools affiliated with major Indian education boards.

### Columns

| Column   | Description                                     |
| -------- | ----------------------------------------------- |
| `name`   | School name                                     |
| `city`   | City where the school is located                |
| `state`  | State or Union Territory                        |
| `board`  | Education board (CBSE, ICSE, State Board, etc.) |
| `rating` | School rating (where available)                 |

### Coverage

Includes schools affiliated with:

* CBSE
* ICSE
* State Education Boards
* International boards (where available)

---

## `india_cities.csv` — 4,242 cities

A comprehensive dataset of cities and towns across **all 28 states and 8 Union Territories of India**.

### Columns

| Column  | Description              |
| ------- | ------------------------ |
| `state` | State or Union Territory |
| `city`  | City or town name        |

This dataset is useful for:

* location dropdowns in apps
* geographic analysis
* education mapping projects
* search and filtering systems

---

# Dataset Statistics

| Dataset              | Records |
| -------------------- | ------- |
| Colleges             | 1,203   |
| Schools              | 247     |
| Cities               | 4,242   |
| States & UTs Covered | 36      |

---

# Data Sources

Data compiled and cleaned from multiple publicly available sources including:

* **NIRF Rankings 2024** (Ministry of Education, Government of India)
* Kaggle education datasets
* Indian institution directories
* Publicly available college and school listings
* India cities datasets
* Manual verification for major institutions

---

# Data Cleaning Process

The dataset was cleaned and standardized using the following steps:

* Duplicate institutions removed using name matching
* State names normalized (e.g., Orissa → Odisha, Pondicherry → Puducherry)
* Cities deduplicated within each state
* Institution names standardized (e.g., shortened versions for IITs, NITs, etc.)
* Missing city/state values filled using cross-references where possible
* Data formatted for easy use in applications and analytics

---

# Example Usage

```python
import pandas as pd

colleges = pd.read_csv("india_colleges.csv")
schools = pd.read_csv("india_schools.csv")
cities = pd.read_csv("india_cities.csv")

# All IITs
iits = colleges[colleges["type"] == "IIT"]

# Colleges in Maharashtra
maha_colleges = colleges[colleges["state"] == "Maharashtra"]

# Schools in Delhi
delhi_schools = schools[schools["state"] == "Delhi"]

# Search institutions by name
colleges[colleges["name"].str.contains("IIT", case=False)]
```

---

# Potential Use Cases

* College search applications
* School discovery platforms
* Education analytics dashboards
* Geographic data analysis
* Machine learning datasets
* Student marketplaces

---

# License

Free for **personal and commercial use**. Attribution is appreciated but not required.

---

Built for the [Student Shop](https://github.com/io-PEAK/student-shop) project — a campus marketplace platform for Indian students.