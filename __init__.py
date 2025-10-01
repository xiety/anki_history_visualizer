from dataclasses import dataclass
import dataclasses
import datetime
from itertools import groupby
import json
from operator import itemgetter
from typing import Any, List
from aqt import QWebEngineScript, QWebEngineView, Qt, mw
from aqt.browser.card_info import BrowserCardInfo
from aqt.main import AnkiQt
import aqt
from aqt.qt import QAction, QDialog, QVBoxLayout
from aqt.webview import AnkiWebView
from anki.utils import ids2str
import os


@dataclass
class Revlog:
    revlog_id: int
    day: int
    revlog_type: int
    interval_due: int
    grade: int
    counter: int

@dataclass
class Card:
    note_id: int
    card_id: int
    due_day: int
    steps: List[Revlog]


@dataclass
class GetCardsResponse:
    min_day: datetime
    max_day: datetime
    cards: List[Card]


@dataclass
class CardInfoResponse:
    question: str
    answer: str


class EnhancedJSONEncoder(json.JSONEncoder):
    def default(self, o):
        if dataclasses.is_dataclass(o):
            return dataclasses.asdict(o)
        return super().default(o)


class HistoryVisualizerDialog(QDialog):
    def __init__(self, mw: AnkiQt) -> None:
        QDialog.__init__(self, parent=None)

        self.setWindowFlag(Qt.WindowType.WindowMinimizeButtonHint)
        self.setWindowFlag(Qt.WindowType.WindowMaximizeButtonHint)

        layout = QVBoxLayout()
        self.setLayout(layout)

        self.mw = mw
        self.deck = self.mw.col.decks.current()

        self.name = 'HistoryVisualizer'
        self.setWindowTitle('History Visualizer: ' + self.deck['name'])
        self.period = 0

        self.setObjectName('Dialog')
        self.resize(840, 770)

        self._add_webview()
        layout.addWidget(self.web)

        self._card_info = BrowserCardInfo(self.mw)

        # debug
        #self.dev = QWebEngineView()
        #self.web.page().setDevToolsPage(self.dev.page())
        #self.dev.show()

        self.activateWindow()

    def _add_webview(self):
        self.web = AnkiWebView()

        self.web.set_bridge_command(self.onBridgeCmd, self)

        filename = f"{os.path.join(os.path.dirname(__file__), 'dist', 'index.css')}"
        with open(filename, 'r') as f:
            style = f.read()

        filename = f"{os.path.join(os.path.dirname(__file__), 'dist', 'index.js')}"
        with open(filename, 'r') as f:
            script_text = f.read()

        # wrapping script in self called function because minifed vue script changes `qt` global variable, that is used by Anki pycmd function
        script_text = '(function(){' + script_text + '})();'

        body = f"<style>{style}</style><div id='app'></div>"

        script = QWebEngineScript()
        script.setSourceCode(script_text)
        script.setWorldId(QWebEngineScript.ScriptWorldId.MainWorld)
        script.setInjectionPoint(QWebEngineScript.InjectionPoint.Deferred)
        script.setRunsOnSubFrames(False)
        self.web.page().profile().scripts().insert(script)

        # pass `js` list to disable jquery loading
        self.web.stdHtml(body, js=[], context=self)

    def _calculate_periods(self, group, due, min_day, card_id):
        periods = []
        previous_day = min_day
        counter = 0

        for row in group:
            day, ease, ivl, revlog_type, revlog_id = row[5], row[6], row[7], row[8], row[9]

            interval_due = ivl

            periods.append(Revlog(revlog_id, day - min_day, revlog_type, interval_due, ease, counter))
            previous_day = day

            if ease > 0 or revlog_type == -1:
                counter += 1

        # if the due review is not on the same day as the last review
        if due != previous_day:
            periods.append(Revlog(-card_id, due - min_day, -1, due - previous_day, 0, counter))

        return periods

    def _get_cards(self) -> GetCardsResponse:
        deck_id = self.deck['id']
        card_list = self.query_cards(deck_id)

        if not card_list:
            return GetCardsResponse(0, 0, [])

        global_min_day = card_list[0][0]
        global_max_day = card_list[0][1]

        grouped_data = [
            Card(
                note_id=note_id,
                card_id=card_id,
                due_day=due_day - global_min_day,
                steps=self._calculate_periods(g, due_day, global_min_day, card_id)
            )
            for (note_id, card_id, due_day), g
            in groupby(card_list, key=itemgetter(2, 3, 4))
        ]
        return GetCardsResponse(global_min_day, global_max_day, grouped_data)

    def query_cards(self, deck_id):
        dids = [id for (_, id) in mw.col.decks.deck_and_child_name_ids(deck_id)]
        rollover = mw.col.conf.get('rollover', 4) * 3600 * 1000

        query = f"""
WITH target_cards AS (
    SELECT id, nid, queue, due
    FROM cards
    where did in {ids2str(dids)} and queue in (1, 2)
),
day_calc AS (
    SELECT
        r.id AS revlog_id,
        r.cid,
        r.ease,
        r.type,
        r.ivl,
        (r.id - {rollover}) / 86400000 AS day
    FROM revlog r
    JOIN target_cards tc ON r.cid = tc.id
),
revlog_data AS (
    SELECT
        revlog_id,
        cid,
        ease,
        type,
        day,
        ROW_NUMBER() OVER (
            PARTITION BY cid, day
            ORDER BY IIF(ease > 0, 0, 1), revlog_id
        ) AS rn_first,
        FIRST_VALUE(IIF(ivl >= 0, ivl, 0))
            OVER (PARTITION BY cid, day ORDER BY revlog_id DESC) AS ivl
    FROM day_calc
)

SELECT
    (SELECT MIN(day) FROM revlog_data WHERE rn_first = 1) AS min_day,
    (SELECT MAX(day) FROM revlog_data WHERE rn_first = 1) AS max_day,
    n.id AS note_id,
    c.id AS card_id,

    CASE c.queue
        WHEN 1 THEN c.due / 86400
        ELSE (col.crt / 86400) + c.due
    END AS card_due,

    r.day AS revlog_day,
    r.ease AS revlog_ease,
    r.ivl AS ivl,
    r.type AS revlog_type,
    r.revlog_id
FROM notes n
JOIN cards c ON c.nid = n.id
JOIN target_cards tc ON tc.id = c.id
CROSS JOIN col
LEFT JOIN revlog_data r
       ON  r.cid = c.id
       AND r.rn_first = 1
ORDER BY min(r.day) OVER (PARTITION BY n.id, c.id), note_id, card_id, revlog_day
"""

        return mw.col.db.all(query)

    def onBridgeCmd(self, cmd: str) -> Any:
        if ':' in cmd:
            (cmd, args) = cmd.split(':', 1)

        if (cmd == 'get_cards'):
            return self._toJson(self._get_cards())

        elif (cmd == 'open_browser'):
            aqt.dialogs.open('Browser', self.mw, search=(args,))
            return self._toJson(True)

        elif (cmd == 'open_card_info'):
            self._card_info.show()
            return self._toJson(True)

        elif (cmd == 'card_info'):
            card_id = int(args)
            card = mw.col.get_card(card_id)

            self._card_info.set_card(card)

            render = card.render_output()
            question = render.question_text
            answer = render.answer_text

            return self._toJson(CardInfoResponse(question, answer))

        return 'Unhandled command: ' + cmd

    def _toJson(self, data):
        return json.dumps(data, cls=EnhancedJSONEncoder)


def show_window():
    dialog = HistoryVisualizerDialog(mw)
    dialog.show()


def add_menu_item():
    action = QAction('Visualize History', mw)
    action.triggered.connect(show_window)
    mw.form.menuTools.addAction(action)


add_menu_item()
