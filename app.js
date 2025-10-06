const App =  (function(){
    const isBlank = (data) => {
        return ( $.trim(data).length == 0 );
    }

    const updateQueryParam = (object) => {
        let urlParams = new URLSearchParams(window.location.search);
        let param = {};
        for(let i of urlParams.keys()) {
            param[i] = urlParams.get(i);
        }
        let obj = Object.assign(param, object);
        let paramAsString = Object.entries(obj).map(([key, value]) => `${key}=${value}`).join('&');
        let newUrl  = window.location.origin + window.location.pathname + "?" + paramAsString;
        window.history.pushState({path:newUrl},'',newUrl);
    }

    let pmt = (rate, nperiod, pv) => {
        let fv = 0;
        let type = 0;

        if (rate == 0) return -(pv + fv)/nperiod;

        var pvif = Math.pow(1 + rate, nperiod);
        var pmt = rate / (pvif - 1) * -(pv * pvif + fv);

        if (type == 1) {
            pmt /= (1 + rate);
        };

        return pmt;
    }

    let calculateAmountInPmt = (totalMonth, calcMonth, rate, money) => {
        let amount = -1 * pmt(rate/12/100, totalMonth, money);
        let remainAmount = money;
        let totalAmount = 0, totalInterest = 0;
        let result = [];
        for(let i = 1; i <= calcMonth; i++) {
            let interest = remainAmount * rate/12/100;
            let amountWithoutInterestRate = amount - interest;
            totalInterest += interest;
            totalAmount += amount;

            remainAmount = remainAmount - amountWithoutInterestRate;
            result.push({
                interestRate: rate,
                interest: interest,
                totalInterest: totalInterest,
                amountWithoutInterestRate: amountWithoutInterestRate,
                amount: amount,
                totalAmount: totalAmount,
                remainAmount: Math.round(Math.abs(remainAmount)),
            });
        }
        return result;
    }

    return {
        calculate: () => {
            if (this.timer) {
                clearTimeout(this.timer);
                this.timer = null;
            }
            this.timer = setTimeout(() => {
                App.calculateDelay();
            }, 500);
        },
        createChart: (result) => {
            let data = result.data;
            if(!data || data.length == 0) return;
            let chart = Chart.getChart('chart');
            let labels = data.map(d => d.month);
            let datas = data.map(d => d.amount);
            let tooltip = {
                callbacks: {
                    title: function(context) {
                        return `Tháng ` + (context[0].dataIndex + 1);
                    },
                    label: function(context) {
                        let item = data[context.dataIndex];
                        return `Gốc & Lãi: ${Math.round(item.amount).toLocaleString()}`;
                    },
                    afterBody: function(context) {
                        let item = data[context[0].dataIndex];
                        return [
                            `Lãi suất: ${item.interestRate}%`,
                            `Tiền lãi: ${Math.round(item.interest).toLocaleString()}`,
                            `Tiền gốc: ${Math.round(item.amountWithoutInterestRate).toLocaleString()}`,
                            `Tổng tiền lãi đã trả: ${Math.round(item.totalInterest).toLocaleString()}`,
                            `Tổng tiền gốc đã trả: ${Math.round(item.totalAmountWithoutInterestRate).toLocaleString()}`,
                            `Tổng tiền gốc & lãi đã trả: ${Math.round(item.totalAmount).toLocaleString()}`,
                            `Tiền gốc còn lại: ${Math.round(item.remainAmount).toLocaleString()}`
                        ];
                    }
                }
            };
            let datasetLabel = `Tổng lãi: ${Math.round(result.totalInterest).toLocaleString()}, Tổng gốc & lãi: ${Math.round(result.totalAmount).toLocaleString()}`;
            if(chart) {
                chart.data.labels = labels;
                chart.data.datasets[0].data = datas;
                chart.data.datasets[0].label = datasetLabel;
                chart.options.plugins.tooltip = tooltip;
                chart.update();
            } else {
                let ctx = document.getElementById('chart').getContext('2d');
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: datasetLabel,
                                data: datas,
                                borderColor: 'rgb(206, 212, 218)',
                                backgroundColor: '#fd7e14'
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        onResize: function (param) {},
                        plugins: {
                            tooltip: tooltip,
                        }
                    },
                });
            }

        },
        calculateDelay: () => {
            let form = $('#frmTienVay').closest("form").serializeArray().map(function(x){
                if(['money','month','interestRate','interestRateAfterPromotion','periodPromotion'].indexOf(x.name) != -1 && x.value) {
                    this[x.name] = parseFloat(x.value.replaceAll(',', ''));
                } else if(['chkAfterPromotion'].indexOf(x.name) != -1) {
                    this[x.name] = x.value == 'on' ? true : false;
                } else {
                    this[x.name] = x.value;
                }

                return this;
            }.bind({}))[0];
            if (isBlank(form.month) || isBlank(form.interestRate) || isBlank(form.money)) {
                return;
            }
            updateQueryParam(form);

            let totalInterest = 0, totalAmount = 0;

            let result = [];
            if(form.method == "goc_co_dinh") {
                let everyMonth = form.money/form.month;
                let remainAmount = form.money;
                for(let i = 1; i <= form.month; i++) {
                    let interestRate = form.interestRate;
                    if(form.chkAfterPromotion && form.periodPromotion > 0 && form.interestRateAfterPromotion > 0) {
                        if(i > form.periodPromotion) {
                            interestRate = form.interestRateAfterPromotion;
                        }
                    }
                    let interest = (remainAmount * interestRate) / (12 * 100);
                    totalInterest += interest;
                    let amount = interest + everyMonth;
                    totalAmount += amount;
                    remainAmount -= everyMonth;
                    result.push({
                        month: i,
                        interestRate: interestRate,
                        interest: interest,
                        totalInterest: totalInterest,
                        amountWithoutInterestRate: everyMonth,
                        totalAmountWithoutInterestRate: everyMonth * i,
                        amount: amount,
                        totalAmount: totalAmount,
                        remainAmount: Math.abs(remainAmount)
                    });
                }
            } else {
                let calcMonth = form.month;
                if(form.chkAfterPromotion && form.periodPromotion > 0 && form.interestRateAfterPromotion > 0) {
                    calcMonth = form.periodPromotion;
                }
                result = result.concat(calculateAmountInPmt(form.month, calcMonth, form.interestRate, form.money));
                if(form.chkAfterPromotion && form.periodPromotion > 0 && form.interestRateAfterPromotion > 0) {
                    let totalOriginalPay = result.map(item => item.amountWithoutInterestRate).reduce((a, b) => a + b, 0);
                    result = result.concat(calculateAmountInPmt(form.month - calcMonth, form.month - calcMonth, form.interestRateAfterPromotion, form.money - totalOriginalPay));
                }

                let totalAmountWithoutInterestRate = 0;
                result.forEach((item, idx) => {
                    totalAmountWithoutInterestRate += item.amountWithoutInterestRate;
                    item.month = idx + 1;
                    item.totalAmountWithoutInterestRate = totalAmountWithoutInterestRate;
                });
                totalInterest = result.map(r => r.interest).reduce((a, b) => a + b, 0);
                totalAmount = result.map(r => r.amount).reduce((a, b) => a + b, 0);
            }
            $("#totalPaymentInterestRate").text(`${Math.round(totalInterest).toLocaleString()} VND`);
            $("#totalAmount").text(`${Math.round(totalAmount).toLocaleString()} VND`);
            $("#firstMonth").text(
                result.length > 0
                    ? `${Math.round(result[0].amount).toLocaleString()} VND`
                    : '0 VND'
            );

            App.createChart({data: result, totalAmount: totalAmount,  totalInterest: totalInterest});
            // render table
            let tbody = "";
            result.forEach((r, idx) => {
                tbody += `<tr>
                          <th scope="row">${idx + 1}</th>
                          <td>${Math.round(r.amountWithoutInterestRate).toLocaleString()}</td>
                          <td>${Math.round(r.interest).toLocaleString()}</td>
                          <td>${Math.round(r.amount).toLocaleString()}</td>
                          <td>${Math.round(r.remainAmount).toLocaleString()}</td>
                          <td>${Math.round(r.totalInterest).toLocaleString()}</td>
                          <td>${Math.round(r.totalAmountWithoutInterestRate).toLocaleString()}</td>
                        </tr>`;
            });
            App.result = result;
            $("#table tbody").html(tbody);
            $("#table").removeClass('d-none');
            $("#download-csv").removeClass('d-none');

        }
    }
})();
$(function(){
    $("#frmTienVay #txtMoney").autoNumeric('init', {vMin: 0, mDec: 0});
    $("#frmTienVay #txtMonth").autoNumeric('init', {vMin: 0, mDec: 0, vMax: 1000});
    $("#frmTienVay #txtInterestRate, #frmTienVay #txtInterestRateAfterPromotion").autoNumeric('init', {vMin: 0});

    App.calculate();

    $("#frmTienVay").on("keyup", "#txtMoney, #txtInterestRate, #txtPeriodPromotion, #txtMonth, #txtInterestRateAfterPromotion",(evt) => {
        let input = $(evt.target);
        switch (input.attr('id')) {
            case 'txtMoney':
                $("#sliderMoney").val(input.val().replaceAll(",", ""));
                break;
            case 'txtInterestRate':
                $("#sliderInterestRate").val(input.val().replaceAll(",", ""));
                break;
            case 'txtMonth':
                $("#sliderMonth").val(input.val().replaceAll(",", ""));
                break;
        }
        App.calculate();
    });

    $("#chkAfterPromotion").change(function(evt) {
        if(this.checked) {
            $("#chkAfterPromotionFields").removeClass("d-none");
        } else {
            $("#chkAfterPromotionFields").addClass("d-none");
        }
        App.calculate();
    })

    $("#frmTienVay input[name=method]").change(function(evt) {
        App.calculate();
    })

    $("#sliderMoney, #sliderInterestRate, #sliderMonth").on('input', function(evt) {
        switch ($(this).attr('id')) {
            case 'sliderMoney':
                $("#txtMoney").val($(this).val()).autoNumeric('update');
                break;
            case 'sliderInterestRate':
                $("#txtInterestRate").val($(this).val()).autoNumeric('update');
                break;
            case 'sliderMonth':
                $("#txtMonth").val($(this).val()).autoNumeric('update');
                break;
        }
        App.calculate();
    })

    $("#download-csv").click((evt)=>{
        evt.preventDefault();
        const rows = [
            ["Tháng", "Tiền gốc", "Tiền lãi", "Gốc & lãi", "Gốc còn lại", "Tổng lãi", "Tổng gốc"]
        ];
        App.result.forEach((r, idx) => {
            rows.push([
                idx + 1,
                Math.round(r.amountWithoutInterestRate),
                Math.round(r.interest),
                Math.round(r.amount),
                Math.round(r.remainAmount),
                Math.round(r.totalInterest),
                Math.round(r.totalAmountWithoutInterestRate)
            ]);
        });
        let csvContent = "data:text/csv;charset=utf-8,"
            + rows.map(e => e.join(",")).join("\n");
        var encodedUri = encodeURI(csvContent);
        var link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "tien_vay.csv");
        document.body.appendChild(link);
        link.click();
    })
});
