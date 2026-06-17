using Microsoft.Data.Sqlite;
var path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ST2", "oportunidades.db");
Console.WriteLine("DB: " + path);
if (!File.Exists(path)) { Console.WriteLine("No existe"); return; }
using var c = new SqliteConnection("Data Source=" + path);
c.Open();
using var cmd = c.CreateCommand();
cmd.CommandText = "SELECT id, fecha, substr(descripcion,1,50), usuario, confirmada FROM oportunidades ORDER BY id";
using var r = cmd.ExecuteReader();
while (r.Read()) Console.WriteLine($"{r.GetInt32(0)} | {r.GetString(1)} | {r.GetString(2)} | [{r.GetString(3)}] | {r.GetString(4)}");
cmd.CommandText = "SELECT COUNT(*) FROM oportunidades";
cmd.Parameters.Clear();
Console.WriteLine("Total: " + cmd.ExecuteScalar());
