## Introducción
Este documento recoge el proceso de desarrollo de un pequeño gestor de tareas cuya interfaz estará desarrollada con `JavaScript` y cuya persistencia de datos se realizará mediante `PHP` y `MariaDB`.

El objetivo es construir una arquitectura en la que `JavaScript` se comunique con una API desarrollada en `PHP` mediante peticiones `HTTP` y respuestas `JSON`. `PHP` será responsable de interactuar con `MariaDB` utilizando `PDO`.

Para aislar los servicios y facilitar la reproducibilidad del entorno, utilizaremos Docker y contenedores independientes:

- ***php-reto***: Servidor web con `PHP 8.4` y `Apache`.
- ***mariadb-reto***: Base de datos basada en la imagen *`mariadb:latest`*.

### Requisitos
El software utilizado en la máquina física para este proyecto es el siguiente: 
- **Windows 10** con entorno **WSL2** (*Ubuntu 24*).
- **Docker Desktop** (*Contenedores: **MariaDB, PHP 8.4 - Apache***).
---
## 1. Preparación de `MariaDB`

### Preparación del entorno
Para iniciar un entorno de base de datos aislado, utilizaremos la imagen oficial de `MariaDB` desde **`DockerHub`**. Definiremos una tabla llamada `tareas` donde alojaremos las tareas con los campos `id`, `nombre` y `completada`.

Ejecutamos el siguiente comando para levantar el contenedor:
```bash
docker run --name mariadb-reto -e MYSQL_ROOT_PASSWORD=root1234 -d -p 3306:3306 mariadb:latest
```

#### Desglose del comando:
- `docker run`: Indicamos a **Docker** que cree y arranque un nuevo contenedor.

- `--name mariadb-reto`: Le asignamos un nombre sencillo al contenedor. Si no lo indicamos, **Docker** asignaría un nombre aleatorio.

- `-e MYSQL_ROOT_PASSWORD=root1234`: Configura la contraseña del usuario `root` mediante una variable de entorno.

- El parámetro `-d` indica  el modo *detached*, es decir, que el contenedor corra en segundo plano liberando la terminal.

- El parámetro `-p 3306:3306` mapea los puertos. Conecta un puerto de la máquina local con el puerto interno del contenedor: `puerto_PC : puerto_contenedor`. El segundo es el puerto en el que MariaDB está escuchando dentro del contenedor. El primer 3306 es el puerto que se abre en la máquina física para poder conectarse desde programas externos. [^1] 

- `mariadb:latest`. Es el nombre de la imagen base, el *plano* que Docker va a utilizar para construir el contenedor. La etiqueta `:latest` indica que descargue y use la versión oficial más reciente disponible en Docker Hub.
---
### Configuración de la Base de Datos

#### Acceso a `MariaDB`:
Una vez funcionando el contenedor, para acceder al cliente de `MariaDB`, nos conectamos al contenedor de la siguiente forma:
```bash
docker exec -it mariadb-reto mariadb -u root -proot1234
```

##### Desglose del comando:
Utilizamos `-it` para hacer la entrada interactiva (`-i`) y asignar una consola de texto (`-t`). Una vez hayamos abierto la sesión interactiva con el cliente de MariaDB, podremos ejecutar comandos SQL.

### Creación de la Base de Datos `gestor_tareas`:
Se ha creado la base de datos dentro del contenedor `mariadb-reto` con el nombre *gestor_tareas*: 
```sql
SHOW DATABASES;
CREATE DATABASE gestor_tareas;
```
#### Diseño de la tabla `tareas`
Hemos diseñado la siguiente tabla con nombre `tareas`:

| Columna    | Tipo de Dato | Restricciones      | Función                      |
| ---------- | :----------- | ------------------ | ---------------------------- |
| id         | INT(11)      | PK, AUTO_INCREMENT | Identificador de la tareas   |
| nombre     | VARCHAR(150) | NOT NULL           | Nombre de la tarea           |
| completada | TINYINT(1)   | NOT NULL           | Marcar el estado de la tarea |
#### Creación de la tabla `tareas`
El primer paso sería, una vez dentro de la consola interactiva de `MariaDB`, crear la base de datos y seleccionarla para comenzar a trabajar en ella:
```sql
USE gestor_tareas;
```

Pasamos a crear la tabla `tareas`,  con sus campos previamente diseñados: 
```sql
 CREATE TABLE tareas (
   completada BOOLEAN NOT NULL DEFAULT FALSE,
   nombre VARCHAR(150) NOT NULL,
   id INT PRIMARY KEY AUTO_INCREMENT);
```

Resultado en consola:
```sql
MariaDB [gestor_tareas]> DESCRIBE tareas;
+------------+--------------+------+-----+---------+----------------+
| Field      | Type         | Null | Key | Default | Extra          |
+------------+--------------+------+-----+---------+----------------+
| nombre     | varchar(150) | NO   |     | NULL    |                |
| completada | tinyint(1)   | NO   |     | 0       |                |
| id         | int(11)      | NO   | PRI | NULL    | auto_increment |
+------------+--------------+------+-----+---------+----------------+
```
#### Inserción de registros de prueba
Ahora podemos insertar algunos registros de prueba y acceder a ellos para comprobar que es correcto. No es necesario incluir el campo `id`, ya que se define automáticamente al tener la restricción `AUTO_INCREMENT`:
```sql
INSERT INTO tareas (nombre, completada)
	VALUES ('Estudiar PHP', 0),
	('Aprender Docker', 0),
	('Pagar Multas DGT', 0),
	('Amar a mi novia <3', 1),
	('Repartir fruta', 1);
```

#### Consulta SQL de los registros de prueba
Con la siguiente orden podemos consultar sus datos:
```sql
MariaDB [gestor_tareas]> SELECT * FROM tareas;
+----+--------------------+------------+
| id | nombre             | completada |
+----+--------------------+------------+
|  1 | Estudiar PHP       |          0 |
|  2 | Aprender Docker    |          0 |
|  3 | Pagar Multas DGT   |          0 |
|  4 | Amar a mi Novia <3 |          1 |
|  5 | Repartir fruta     |          1 |
+----+--------------------+------------+
5 rows in set (0.001 sec)
```
#### Creación de un usuario específico para la aplicación:
Por seguridad y buenas prácticas, crearemos un usuario para acceder a las operaciones dentro de la base de datos. De esta manera, evitaríamos un riesgo alto contra inyecciones `SQL`, además de establecer un control más estricto sobre operaciones mas *peligrosas* sobre la base de datos.
```sql
CREATE USER 'tareas_app'@'%' IDENTIFIED BY 'CONTRASEÑA';
```

#### Concesión de los permisos necesarios:
Aplicaremos únicamente los permisos que serán utilizados por el usuario dentro de la base de datos, de esta manera aplicaremos **el principio del menor privilegio**. Esto significa que cada proceso o usuario de un sistema debe tener acceso únicamente a la información y recursos que son estrictamente necesarios para hacer su trabajo.:
```sql
GRANT SELECT, INSERT, UPDATE, DELETE
ON gestor_tareas.*
TO 'tareas_app'@'%';
```

#### Consulta de los usuarios existentes: 
```sql
MariaDB [gestor_tareas]> SELECT User, Host FROM mysql.user;
+-------------+-----------+
| User        | Host      |
+-------------+-----------+
| root        | %         |
| tareas_app  | %         |
| healthcheck | 127.0.0.1 |
| healthcheck | ::1       |
| healthcheck | localhost |
| mariadb.sys | localhost |
| root        | localhost |
+-------------+-----------+
```

#### Consulta de los permisos del usuario `tareas_app`:
Comprobamos que hemos añadido correctamente los permisos:
```sql
MariaDB [gestor_tareas]> SHOW GRANTS FOR 'tareas_app'@'%';
+-----------------------------------------------------------------------------------------------------------+
| Grants for tareas_app@%                                                                                   |
+-----------------------------------------------------------------------------------------------------------+
| GRANT USAGE ON *.* TO `tareas_app`@`%` IDENTIFIED BY PASSWORD '*AF129D16A855783E8FB5E0A8FD3514954958D728' |
| GRANT SELECT, INSERT, UPDATE, DELETE ON `gestor_tareas`.* TO `tareas_app`@`%`                             |
+-----------------------------------------------------------------------------------------------------------+
2 rows in set (0.001 sec)
```

## 2. `PHP` con`MariaDB`

### Redes en `Docker` y Comunicación entre Contenedores
Para que el contenedor de `PHP` pueda comunicarse con el de `MariaDB`, evitaremos usar direcciones IP locales mutables. En su lugar, creamos una red privada dedicada.
#### Creación de la red (`network`)
Docker dispone de una red predeterminada llamada `bridge`, pero hemos creado una nueva red `mini-reto-network` para comunicar ambos contenedores:

```bash
docker network create mini-reto-network
```

#### Enlazar `MariaDB` con la red
Actualmente, el contenedor de `MariaDB` está conectado a la red por defecto `bridge`, por lo que debemos conectarlo a la red personalizada `mini-reto-network` para permitir la comunicación con otros contenedores mediante sus nombres. De esta manera, el contenedor `PHP` podrá localizar a `MariaDB` utilizando `mariadb-reto`, sin depender de una dirección IP que pueda cambiar:

```bash
docker network connect mini-reto-network mariadb-reto
```

### Configuración del Entorno `PHP`
Crearemos un entorno `PHP` dentro de un contenedor con la siguiente configuración:

| Elemento                | Configuración       |
| ----------------------- | ------------------- |
| Nombre                  | `php-reto`          |
| Imagen Base             | `php:8.4-apache`    |
| Servidor Web            | Apache              |
| Extensión               | `pdo_mysql`         |
| Red                     | `mini-reto-network` |
| Puerto Web              | `8080`              |
| Directorio del Proyecto | `~/mini-reto`       |
Construiremos nuestra imagen mediante un `Dockerfile` en lugar de descargar una imagen genérica de la cual desconoceremos su configuración.

---
##### Creación del `Dockerfile`
En la raíz de nuestro directorio de trabajo: `~/mini-reto` Creamos un `Dockerfile` con las siguientes líneas:
```dockerfile
# Imagen base de PHP con Apache
FROM php:8.4-apache

# Instalación del controlador PDO para MySQL/MariaDB
RUN docker-php-ext-install pdo_mysql

# Directorio de trabajo dentro del contenedor
WORKDIR /var/www/html
```
##### Construcción de la imagen (`docker build`)
El `Dockerfile` define cómo se construye la imagen, luego, utilizaremos esa imagen para crear el contenedor `php-reto`. Compilamos el archivo de configuración para generar la imagen local:
```bash
docker build -t php-reto:local .
```
###### Desglose del comando:
- `docker build`: construye una imagen.
- `-t php-reto:local`: asigna nombre y etiqueta a la imagen.  
- `.`: utiliza el directorio actual como contexto de construcción.
---
#### Creación del contenedor `PHP`
El `Dockerfile` contiene las instrucciones para construir una imagen. Una vez construida, podemos utilizarla para crear uno o varios contenedores independientes.
```bash
docker run -d \
  --name php-reto \
  --network mini-reto-network \
  -p 8080:80 \
  -v "$PWD":/var/www/html \
  php-reto:local
```
##### Desglose del comando:
- `--name php-reto`. Nombre del contenedor.
- `--network mini-reto-network`. Lo conecta a nuestra red privada.
- `-p 8080:80`. Puerto 8080 de Ubuntu → puerto 80 de Apache.
- `-v "$PWD":/var/www/html`. Comparte tu carpeta actual con el directorio web del contenedor.
- `php-reto:local`. Imagen que hemos construido.

#### Comprobación del contenedor
Comprobamos el estado del contenedor con:
```bash
docker ps --filter "name=php-reto"
```

Si está levantado y no hay problemas, crearemos nuestro primer `index.php` y vemos si funciona correctamente desde el navegador.
```php
<?php
phpinfo();
```

### Conexión de `PHP` con `MariaDB` mediante `PDO`

#### Comprobaciones del entorno PHP
Antes de comenzar, debemos revisar qué módulos de `PHP` tenemos. Para poder conectar la base de datos de una forma más cómoda y universal, utilizaremos la extensión de `PHP PDO (PHP Data Objects)`. Deberíamos tenerla instalada junto a sus dependencias, porque así lo indicamos en el `Dockerfile` previamente. 
```bash
arzajr@DESKTOP-0BR15FT:~/mini-reto$ docker exec php-reto php -m | grep -E 'pdo|PDO'
PDO
pdo_mysql
pdo_sqlite
```



[^1]: Mapear el puerto hacia el exterior no es **estrictamente** necesario exponer el puerto al PC, ya que PHP hablará internamente con `MariaDB` mediante la red `mini-reto-network`. **Docker publica ese puerto en las interfaces de red del host por defecto**.
