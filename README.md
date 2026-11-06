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

## Estado del proyecto

| Completado                                                                             | En Curso                                                                        |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Preparación del entorno Docker : Contenedores MariaDB y PHP con su red correspondiente | Actualización de la base de datos al marcar/desmarcar una tarea como completada |
| Conexión de PHP con MariaDB mediante PDO                                               | Actualización de la base de datos al eliminar una tarea                         |
| Carga de las tareas de la base de datos en el index.html                               | Actualización de la base de datos al añadir una tarea                           |
|                                                                                        | Comprobar que la respuesta HTTP ha sido satisfactoria dentro de `fetch()`       |

---
## 1. Preparación de `MariaDB`

### Preparación del entorno
Para iniciar un entorno de base de datos aislado, utilizaremos la imagen oficial de `MariaDB` desde **`DockerHub`**. Definiremos una tabla llamada `tareas` donde alojaremos las tareas con los campos `id`, `nombre` y `completada`.

Ejecutamos el siguiente comando para levantar el contenedor:
```bash
docker run --name mariadb-reto -e MYSQL_ROOT_PASSWORD=CONTRASEÑA -d -p 3306:3306 mariadb:latest
```

#### Desglose del comando:
- `docker run`: Indicamos a **Docker** que cree y arranque un nuevo contenedor.

- `--name mariadb-reto`: Le asignamos un nombre sencillo al contenedor. Si no lo indicamos, **Docker** asignaría un nombre aleatorio.

- `-e MYSQL_ROOT_PASSWORD=********`: Configura la contraseña del usuario `root` mediante una variable de entorno.

- El parámetro `-d` indica  el modo *detached*, es decir, que el contenedor corra en segundo plano liberando la terminal.

- El parámetro `-p 3306:3306` mapea los puertos. Conecta un puerto de la máquina local con el puerto interno del contenedor: `puerto_PC : puerto_contenedor`. El segundo es el puerto en el que MariaDB está escuchando dentro del contenedor. El primer 3306 es el puerto que se abre en la máquina física para poder conectarse desde programas externos. [^1] 

- `mariadb:latest`. Es el nombre de la imagen base, el *plano* que Docker va a utilizar para construir el contenedor. La etiqueta `:latest` indica que descargue y use la versión oficial más reciente disponible en Docker Hub.
---
### Configuración de la Base de Datos

#### Acceso a `MariaDB`:
Una vez funcionando el contenedor, para acceder al cliente de `MariaDB`, nos conectamos al contenedor de la siguiente forma:
```bash
docker exec -it mariadb-reto mariadb -u root -pCONTRASEÑA
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
   nombre VARCHAR(150) NOT NULL,
   completada BOOLEAN NOT NULL DEFAULT FALSE,
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
	('Amar a mi Novia <3', 1),
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
Por seguridad y buenas prácticas, crearemos un usuario para acceder a las operaciones dentro de la base de datos. De esta manera, evitaríamos un riesgo alto contra inyecciones `SQL`, además de establecer un control más estricto sobre operaciones mas *peligrosas* sobre la base de datos. Debemos tener en cuenta que esto no evita la inyección, ya que con ese usuario podrían leer o borrar todas nuestras tareas.
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
| GRANT USAGE ON *.* TO `tareas_app`@`%` IDENTIFIED BY PASSWORD '****************************' |
| GRANT SELECT, INSERT, UPDATE, DELETE ON `gestor_tareas`.* TO `tareas_app`@`%`                             |
+-----------------------------------------------------------------------------------------------------------+
2 rows in set (0.001 sec)
```
---
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
Ejecutamos `docker build` para construir una imagen Docker a partir de las instrucciones definidas en el **Dockerfile**:
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

#### Conexión del archivo `db.php`
Configuramos el archivo `db.php` para que se conecte al contenedor de la base de datos `mariadb-reto`. Si usáramos `localhost`, intentaría acceder a la base de datos dentro del contenedor `php-reto`, en la que no existe ninguna base de datos escuchando en el puerto 3306. `PHP` lo localiza porque se encuentran en la misma red Docker `mini-reto-network`, y éste incluye un DNS interno en las redes creadas por el usuario, que traduce el host `mariadb-reto`. Utilizamos el usuario `tareas_app` debido al **principio de menor privilegio** mencionado anteriormente.
```php
<?php 

$dsn = "mysql:host=mariadb-reto;dbname=gestor_tareas;charset=utf8mb4";
$user = "tareas_app";
$pass = "CONTRASEÑA";

try {
    $pdo = new PDO($dsn, $user, $pass);
} catch (PDOException $e) {
    echo "Error de conexión a la base de Datos. <br>", $e->getMessage();
}
```
El `$dsn` (*Data Source Name*) le indica a `PDO` la información necesaria para conectarse a la base de datos. Por ejemplo, el `host` que es el nombre que usa **Docker** para identificar al contenedor de la base de datos y el `dbname` que es la base de datos con la que estableceremos la conexión.

Utilizamos el usuario `tareas_app` desde el que podemos acceder desde cualquier host de la red. Cuando creamos el usuario `'tareas_app'@'%'`en `MariaDB`, el símbolo de porcentaje nos lo indica.[^2] 

Dentro del bloque `try` intentamos la conexión con la información aportada y en caso de fallar, lanza una excepción de la clase `PDOException`. Existe una jerarquía de excepciones, la cual el bloque `catch` la interceptará en función del nivel de la jerarquía que esté trabajando:

`Throwable (INTERFAZ) -> Exception -> RuntimeException -> PDOException`

Un bloque `catch` solo atrapa a su tipo y sus descendientes, nunca a sus ancestros o hermanos. Cuando se ejecuta imprime un mensaje que expone ciertos datos internos.

Este archivo no imprime nada cuando todo va bien porque un `echo` imprimiría texto delante del JSON y `response.json()` fallaría.

#### Archivo `tareas.php`
Este archivo consulta todas las tareas de la tabla `tareas` y las devuelve al cliente en formato `JSON`. Actualmente, el endpoint gestiona las peticiones GET para consultar las tareas. Se añadirán progresivamente las operaciones POST, PATCH y DELETE.
```php
<?php
// Archivo para obtener las filas de la tabla tareas y mostrarlas convertidas a JSON

header('Content-Type: application/json');
require "db.php"; 

if($_SERVER['REQUEST_METHOD'] === 'GET'){

    $consulta = $pdo->query("SELECT * FROM tareas");
    $tareas = $consulta->fetchAll(PDO::FETCH_ASSOC); 

    $resultado = json_encode($tareas);

    echo $resultado;

}
```

##### Flujo del archivo, línea a línea
1. **`header('Content-Type: application/json');`** avisa al cliente de que el cuerpo de la respuesta será `JSON`. No devuelve ningún dato: solo fija una cabecera.
2. **`require "db.php";`** ejecuta `db.php` en este punto. Devuelve la conexión, que queda disponible en la variable `$pdo`.
3. **`$pdo->query("SELECT * FROM tareas")`** envía la consulta a `MariaDB`. Devuelve un objeto `PDOStatement` (guardado en `$consulta`), que apunta a los resultados pero todavía no contiene las tareas.
4. **`$consulta->fetchAll(PDO::FETCH_ASSOC)`** extrae todas las filas. `$tareas` es un array con una fila por tarea, y cada fila es un array **asociativo**: la clave es el nombre de la columna (`id`, `nombre`, `completada`).
5. **`json_encode($tareas)`** convierte ese array de `PHP` en un **texto** (*string*) con formato `JSON`. Lo guardamos en `$resultado`.
6. **`echo $resultado;`** envía ese texto al navegador. Sin esta línea, el script no produciría ninguna salida.

##### ¿Por qué la cabecera va antes del `require`?
Una respuesta `HTTP` envía primero las cabeceras y después el cuerpo. En cuanto `PHP` imprime algo con `echo`, el cuerpo empieza a enviarse y ya no se pueden modificar las cabeceras.

Esto se comprobó provocando un fallo en `db.php` (contraseña incorrecta), cuyo `catch` ejecuta un `echo`:

- **`header()` antes del `require`:** la cabecera se envía primero y el `echo` del `catch` viaja después como cuerpo. No hay ningún aviso.
- **`header()` después del `require`:** el `echo` del `catch` ya ha enviado el cuerpo, así que la cabecera llega tarde y `PHP` muestra `Warning: headers already sent`.

Por eso `header()` va antes: queda fijada pase lo que pase dentro de `db.php`.

---
## 3. Frontend: JavaScript con `fetch()`
### Cómo acceder a la aplicación
Accedemos a la aplicación mediante la siguiente URL: `localhost:8080/frontend/index.html`.
Evidentemente, debemos levantar previamente los contenedores Docker para poder tener acceso.
### Carga del script
El atributo `defer` permite descargar el archivo JavaScript mientras el navegador analiza el HTML. Su ejecución se pospone hasta que termina el análisis del documento, por lo que el script puede acceder a los elementos del DOM. Además, los scripts con `defer` mantienen el orden de ejecución en el que aparecen en el HTML.

Podríamos lograr el mismo resultado utilizando el evento `DOMContentLoaded`, que se dispara cuando la carga del DOM ha sido completada, pero para no introducir todo el código del script dentro de un evento, se ha optado por utilizar la opción con `defer`.
### Lectura de tareas con `fetch (GET)`
```javascript
const listaTareas = document.querySelector("#listaTareas"); 

// Petición fetch a tareas.php
fetch('../tareas.php').then(
    (response) => {
        return response.json();
    }).then(
        (data) => {
            data.forEach(tarea => {
                renderizarTarea(tarea);
            })
        })
        
function renderizarTarea(tarea) { 
    // Representar las tareas dentro del HTML
}
```
Se crea una constante para referirse al `<ul>` del HTML `listaTareas`. A continuación se realiza una petición `fetch` al archivo `tareas.php` que nos devuelve las tareas de la base de datos. Como este proceso no es instantáneo, se ejecuta de forma asíncrona, mientras el script continúa su ejecución, en este caso, renderizando la función que permite mostrar las tareas dentro del HTML.
### Renderizado de las tareas `renderizarTarea(tarea)`
```javascript
function renderizarTarea(tarea) {  

    // Representar las tareas dentro del HTML, creamos el <li>
    const elementoTarea = document.createElement("li");
    const label = document.createElement("label");

    if (tarea.completada == 1) {
        elementoTarea.classList.add("completada");
    }

    // Creamos el <input> (checkbox)
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = tarea.completada; 

    // Hacemos que al marcar el checkbox cambie el estado del objeto
    checkbox.addEventListener("click", function () {
        tarea.completada = !tarea.completada;

        // Si la tarea está completada, tacharla, sino no

        if (tarea.completada == 1) {
            elementoTarea.classList.add("completada");
        } else {
            elementoTarea.classList.remove("completada");
        }
    });

    // Añadimos checkbox al <li>
    label.appendChild(checkbox);
    
    // Creamos el texto con el nombre de la nueva tarea
    const textoTarea = document.createTextNode(tarea.nombre);

    // Añadimos al elemento de la tarea el checkbox
    label.appendChild(textoTarea);

    // Creamos el botón de eliminar
    const botonEliminar = document.createElement("button");

    botonEliminar.textContent = "Eliminar"; 

    // Evento del botón eliminar
    botonEliminar.addEventListener("click", function () {

        // Confirmar borrado
        const confirmar = confirm(
            "¿Estás seguro de que quieres eliminar " + tarea.nombre + " ?"
        );  

        // Borrado del <li>
        if (confirmar) {
            elementoTarea.remove();
        }
    })
  
    elementoTarea.appendChild(label);
  
    // Lo añadimos al li
    elementoTarea.appendChild(botonEliminar);

    // Añadimos el elemento a la lista de tareas
    listaTareas.appendChild(elementoTarea);

}
```

## Limitaciones conocidas
Si la conexión falla, el `catch` de `db.php` imprime un mensaje de texto. El cliente recibiría algo que *declara* ser `JSON` pero no lo es, y `response.json()` fallaría en `JavaScript`. Además, el mensaje expone datos internos. Se corregirá posteriormente. 

[^1]: Mapear el puerto hacia el exterior no es **estrictamente** necesario exponer el puerto al PC, ya que PHP hablará internamente con `MariaDB` mediante la red `mini-reto-network`. **Docker publica ese puerto en las interfaces de red del host por defecto**.

[^2]: Esto en producción debería restringirse.
