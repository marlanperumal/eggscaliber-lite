class TestStreamEncoder:
    def test_encode_text_chunk(self):
        from src.services.ai_service import encode_text_chunk

        result = encode_text_chunk("Hello ")
        assert result == '0:"Hello "\n'

    def test_encode_text_chunk_escapes_quotes(self):
        from src.services.ai_service import encode_text_chunk

        result = encode_text_chunk('say "hi"')
        assert result == '0:"say \\"hi\\""\n'

    def test_encode_annotation_part(self):
        from src.services.ai_service import encode_annotation_part

        result = encode_annotation_part({"type": "crosstab_result", "query_config": {}})
        assert result == 'a:[{"type": "crosstab_result", "query_config": {}}]\n'

    def test_encode_finish(self):
        from src.services.ai_service import encode_finish

        result = encode_finish()
        assert result == 'd:{"finishReason": "stop"}\n'

    def test_encode_error(self):
        from src.services.ai_service import encode_error

        result = encode_error("something went wrong")
        assert result == '3:"something went wrong"\n'
