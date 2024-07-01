from dataclasses import dataclass
import dataclasses
import datetime
from itertools import groupby
import json
from operator import attrgetter, itemgetter
from typing import Any, List
from aqt import QWebEngineScript, Qt, mw
from aqt.main import AnkiQt
import aqt
from aqt.qt import QAction, QDialog, QVBoxLayout, QWebEngineView
from aqt.webview import AnkiWebView
from anki.hooks import addHook
import os


class HistoryVisualizerDialog(QDialog):

    def __init__(self, mw: AnkiQt) -> None:
        QDialog.__init__(self, None, Qt.WindowType.Window)
        mw.garbage_collect_on_dialog_finish(self)

        layout = QVBoxLayout()
        self.setLayout(layout)

        self.mw = mw
        self.deck = self.mw.col.decks.current()

        self.name = "HistoryVisualizer"
        self.setWindowTitle("History Visualizer: " + self.deck['name'])
        self.period = 0

        self.setObjectName("Dialog")
        self.resize(880, 726)

        self.web = AnkiWebView()
        layout.addWidget(self.web)

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
        self.web.stdHtml(body, js=['js/webview.js'], context=self)

        # debug
        # self.dev = QWebEngineView()
        # layout.addWidget(self.dev)
        # self.web.page().setDevToolsPage(self.dev.page())

        self.activateWindow()

    def _get_cards(self):
        deck_id = self.deck['id']

        rollover = mw.col.conf.get('rollover', 4) * 60 * 60 * 1000

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
where c.did = {deck_id}
order by min(r.day) over (partition by n.id, c.id), note_id, card_id, revlog_day
        """

        print(query)

        list = mw.col.db.all(query)

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

        if len(list) == 0:
            return []

        min_day = min(list, key=itemgetter(3))[3]

        print('min_day', min_day)

        def calculate_periods(group, card_id, due):
            periods = []
            previous_day = min_day

            for _, _, _, day, ease in group:
                stability = day - previous_day
                periods.append(CardStep(day - min_day, stability, ease))
                previous_day = day

            periods.append(CardStep(due - min_day, due - previous_day, 0))

            return periods

        grouped_data = [Card(note_id, card_id, calculate_periods(g, card_id, due))
                        for (note_id, card_id, due), g
                        in groupby(list, key=itemgetter(0, 1, 2))]

        return GetCardsResponse(min_day, grouped_data)

    # Open browser
    # aqt.dialogs.open("Browser", self.mw, search=(link,))

    def onBridgeCmd(self, cmd: str) -> Any:
        print('Command: ', cmd)

        class EnhancedJSONEncoder(json.JSONEncoder):
            def default(self, o):
                if dataclasses.is_dataclass(o):
                    return dataclasses.asdict(o)
                return super().default(o)

        if (cmd == 'get_cards'):
            return json.dumps(self._get_cards(), cls=EnhancedJSONEncoder)

        return 'Unhandled command: ' + cmd


def show_window():
    dialog = HistoryVisualizerDialog(mw)
    dialog.exec()


def add_menu_item():
    action = QAction('Visualize History', mw)
    action.triggered.connect(show_window)
    mw.form.menuTools.addAction(action)


add_menu_item()
