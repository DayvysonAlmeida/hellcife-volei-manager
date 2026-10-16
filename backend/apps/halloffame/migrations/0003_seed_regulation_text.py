from django.db import migrations

# Texto que antes ficava fixo em frontend/src/pages/RegulationPage.tsx,
# convertido para HTML para continuar disponível no regulamento editável.
REGULATION_HTML = """
<h3>Apresentação</h3>
<p>O Hellcife Vôlei é uma comunidade esportiva dedicada à prática do voleibol, fundamentada nos valores de respeito, disciplina, comprometimento, meritocracia e espírito esportivo.</p>
<p>Nosso propósito é proporcionar um ambiente organizado, competitivo e saudável para o desenvolvimento técnico dos atletas, promovendo integração, evolução contínua e preparação para futuras competições.</p>
<blockquote>"A força de um grupo não está apenas em seus melhores jogadores, mas no compromisso coletivo com a excelência."</blockquote>

<h3>Sistema de Estrelas</h3>
<p><strong>Todo integrante inicia sua trajetória no grupo com 1🌟.</strong></p>
<p>O sistema tem como finalidade classificar os participantes de acordo com critérios de:</p>
<ul>
  <li>Nível técnico</li>
  <li>Desempenho</li>
  <li>Frequência</li>
  <li>Comprometimento</li>
  <li>Antiguidade</li>
  <li>Conduta esportiva</li>
</ul>
<p>As classificações promovem equilíbrio técnico nas equipes e reconhecimento da evolução individual.</p>

<h3>Princípios do Hellcife</h3>
<ul>
  <li>Respeito</li>
  <li>Lealdade</li>
  <li>Comprometimento</li>
  <li>Espírito esportivo</li>
  <li>Evolução contínua</li>
  <li>Meritocracia</li>
  <li>Organização</li>
</ul>

<h3>Programação Oficial</h3>
<div class="table-wrap">
<table>
  <thead>
    <tr><th>Dia</th><th>Horário</th><th>Tipo</th><th>Local</th></tr>
  </thead>
  <tbody>
    <tr><td>Segunda-feira</td><td colspan="3">Livre — sem atividades</td></tr>
    <tr><td>Terça-feira</td><td>20h às 21h</td><td>Areia</td><td>Arena Deep</td></tr>
    <tr><td>Quarta-feira</td><td colspan="3">Livre — sem atividades</td></tr>
    <tr><td>Quinta-feira</td><td>19:30 às 21:30</td><td>Poliesportiva</td><td>Compaz Ariano Suassuna (Em Breve)</td></tr>
    <tr><td>Sexta-feira</td><td>19:30 às 21:30</td><td>Areia</td><td>Arena Belo Gol/Prainha ZS</td></tr>
    <tr><td>Sábado</td><td colspan="3">Livre — sem atividades</td></tr>
    <tr><td>Domingo</td><td>10h às 12h</td><td>Areia</td><td>Compaz Miguel Arraes</td></tr>
  </tbody>
</table>
</div>

<h3>Locais de Atividade</h3>
<ul>
  <li>Prainha ZS</li>
  <li>Belo Gol</li>
  <li>Arena São Miguel</li>
  <li>Arena Deep</li>
  <li>Arena Mago's</li>
  <li>Quadra Lagoa do Araçá (Em Andamento)</li>
  <li>Quadra Compaz Miguel Arraes</li>
  <li>Compaz Ariano Suassuna</li>
</ul>
<p><em>A administração poderá utilizar outros locais sempre que necessário.</em></p>

<h3>Condutas Vedadas &amp; Penalidades</h3>
<h4>Não toleramos:</h4>
<ul>
  <li>Racismo, Homofobia, Machismo, Misoginia</li>
  <li>Qualquer forma de discriminação</li>
  <li>Assédio ou intimidação</li>
  <li>Comportamento antidesportivo</li>
  <li>Ofensas ou ataques pessoais</li>
  <li>Menosprezo ao nível técnico de outros atletas</li>
  <li>Spam e divulgação não autorizada</li>
</ul>
<h4>Faltas sem Justificativa</h4>
<ol>
  <li><strong>1ª Ocorrência</strong> — Advertência</li>
  <li><strong>2ª Ocorrência</strong> — Afastamento</li>
  <li><strong>3ª Ocorrência</strong> — Exclusão</li>
</ol>

<h3>Formato e Inscrições</h3>
<h4>Formato dos Jogos</h4>
<ul>
  <li>Modalidades: 2x2, 3x3 (Exceção), 4x4.</li>
  <li><strong>Areia:</strong> Rodízio de posição não é obrigatório, mas o rodízio de saque é.</li>
  <li>A retirada de 2 times por 2 vitórias consecutivas está <strong>TERMINANTEMENTE</strong> condicionada à presença de 2 times fora de quadra para entrar. Devido à impreterível meritocracia dos vencedores.</li>
  <li><strong>Quadra:</strong> Serão observadas as regras oficiais aplicáveis.</li>
</ul>
<h4>Listas de Inscrição (Compaz Miguel Arraes)</h4>
<ul>
  <li>A lista é liberada 72 horas antes para membros oficiais.</li>
  <li>Convidados podem ser inseridos (no fim da lista) no meio-dia do dia anterior.</li>
  <li>Convidados sobem na ordem se as vagas não forem preenchidas.</li>
  <li><strong>Retirada do nome:</strong> Permitido apenas até as 09h do domingo (Compaz) ou 19h (Prainha ZS). Após o horário, o nome não pode ser removido.</li>
</ul>
""".strip()

PLACEHOLDER = '<p>Conteúdo do regulamento ainda não foi definido.</p>'


def seed_regulation(apps, schema_editor):
    RegulationText = apps.get_model('halloffame', 'RegulationText')
    obj = RegulationText.objects.filter(pk=1).first()
    if obj is None:
        RegulationText.objects.create(pk=1, title='Regulamento Oficial', content=REGULATION_HTML)
    elif obj.content.strip() in ('', PLACEHOLDER):
        # Não sobrescreve um regulamento que já tenha sido editado
        obj.content = REGULATION_HTML
        obj.save(update_fields=['content'])


class Migration(migrations.Migration):

    dependencies = [
        ('halloffame', '0002_regulationtext'),
    ]

    operations = [
        migrations.RunPython(seed_regulation, migrations.RunPython.noop),
    ]
