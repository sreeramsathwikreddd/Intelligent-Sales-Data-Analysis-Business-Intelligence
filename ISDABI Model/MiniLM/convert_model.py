#!/usr/bin/env python3
import logging
from transformers import BertModel, BertTokenizer, TFBertModel

logging.basicConfig(level=logging.INFO, filename="log.txt")
model = BertModel.from_pretrained("../../MiniLM-L12-H384-uncased/")
tf_model = TFBertModel.from_pretrained("../../MiniLM-L12-H384-uncased/", from_pt=True)
model.save_pretrained("./")
tf_model.save_pretrained("./")

tok = BertTokenizer.from_pretrained("../../MiniLM-L12-H384-uncased/")
tok.save_pretrained("./")
