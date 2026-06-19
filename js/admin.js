async function listarAgendamentos() {
  const { data, error } = await supabaseClient
    .from("agendamentos")
    .select("*");

  console.log(data, error);
}
