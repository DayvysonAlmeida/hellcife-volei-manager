from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    """
    Paginação padrão do projeto.
    Aceita o parâmetro `page_size` na query string para controlar
    quantos itens são retornados por página (máx. 1000).
    """
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 1000
