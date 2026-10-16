from decimal import Decimal, ROUND_HALF_UP

from django.db import migrations


def forwards(apps, schema_editor):
    GameDay = apps.get_model('attendance', 'GameDay')
    Attendance = apps.get_model('attendance', 'Attendance')
    AttendancePayment = apps.get_model('attendance', 'AttendancePayment')

    # O campo nunca foi editável pela tela, então todo circuito ficou com 1 crédito por engano.
    # Créditos só voltam a ser cobrados quando os planos forem lançados.
    GameDay.objects.filter(is_closed=False).update(credit_cost=0)

    # Pagamentos marcados antes do controle financeiro viram registros "legado",
    # com o valor estimado do rateio (quadra ÷ presentes), para o histórico não começar zerado.
    payments = []
    for gameday in GameDay.objects.filter(court_price__gt=0):
        present = Attendance.objects.filter(gameday=gameday, present=True).count()
        if not present:
            continue
        amount = (Decimal(gameday.court_price) / present).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        paid = Attendance.objects.filter(gameday=gameday, present=True, has_paid=True, used_credit=False)
        for att in paid:
            att.amount_due = amount
            att.save(update_fields=['amount_due'])
            payments.append(AttendancePayment(
                attendance=att, amount=amount, method='legacy', status='paid', paid_at=att.checked_at,
            ))
    AttendancePayment.objects.bulk_create(payments)


def backwards(apps, schema_editor):
    apps.get_model('attendance', 'AttendancePayment').objects.filter(method='legacy').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0018_circuit_pricing_and_payments'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
