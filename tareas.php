<?php
// Archivo para obtener las filas de la tabla tareas y mostrarlas convertidas a JSON
header('Content-Type: application/json');
require "db.php";

$consulta = $pdo->query("SELECT * FROM tareas");
$tareas = $consulta->fetchAll(PDO::FETCH_ASSOC);
$resultado = json_encode($tareas);

echo $resultado;
