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
class CardStep:
    day: int
    stability: int
    grade: int


@dataclass
class Card:
    note_id: int
    card_id: int
    steps: List[CardStep]


@dataclass
class GetCardsResponse:
    min_day: datetime
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
        # self.dev = QWebEngineView()
        # self.web.page().setDevToolsPage(self.dev.page())
        # self.dev.show()

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

    def _calculate_periods(self, group, due, min_day):
        periods = []
        previous_day = min_day

        for _, _, _, day, ease in group:
            stability = day - previous_day
            periods.append(CardStep(day - min_day, stability, ease))
            previous_day = day

        periods.append(CardStep(due - min_day, due - previous_day, 0))

        return periods

    def _get_cards(self) -> GetCardsResponse:
        deck_id = self.deck['id']

        list = self.query_cards(deck_id)

        if len(list) == 0:
            return GetCardsResponse(None, [])

        min_day = min(list, key=itemgetter(3))[3]

        grouped_data = [Card(note_id, card_id, self._calculate_periods(g, due, min_day))
                        for (note_id, card_id, due), g
                        in groupby(list, key=itemgetter(0, 1, 2))]

        return GetCardsResponse(min_day, grouped_data)

    def query_cards(self, deck_id):
        dids = [id for (_, id) in mw.col.decks.deck_and_child_name_ids(deck_id)]

        rollover = mw.col.conf.get('rollover', 4) * 60 * 60 * 1000 # day_cutoff?

        query = f"""
select n.id note_id, c.id card_id,
        case when c.queue = 1 then cast(c.due / 86400.0 as int)
             when c.queue = 2 or c.queue = -2 then cast(col.crt / 86400.0 as int) + c.due
             end card_due,
        r.day revlog_day, r.ease revlog_ease
from notes n
cross join col
inner join cards c
    on c.nid = n.id and c.queue in (1, 2) -- 1=learning, 2=review
inner join (
    select r.cid, r.ease, r.lastivl, r.day,
            row_number() over(partition by r.cid, r.day order by r.id) as rn 
    from (
    select r.id, r.cid, r.ease, r.lastivl,
        cast((r.id - {rollover}) / 86400000.0 as int) AS day
    from revlog r
    where r.type in (0, 1, 3)
    ) r
) r
on r.cid = c.id and r.rn = 1
where c.did in {ids2str(dids)}
order by min(r.day) over (partition by n.id, c.id), note_id, card_id, revlog_day
        """

        list = mw.col.db.all(query)

        return list

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
