async function criarAgendamento() {
  const nome = document.getElementById("nome").value;

  const { error } = await supabaseClient
    .from("agendamentos")
    .insert([{ nome }]);

  if (error) {
    console.log(error);
  } else {
    alert("Agendado!");
  }
}
